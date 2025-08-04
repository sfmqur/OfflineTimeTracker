import os
import json
import time
import asyncio
from typing import Dict, Optional

# The decky plugin module is located at decky-loader/plugin
import decky

# Constants
CHECK_INTERVAL = 180 # seconds, where we check if we're offline
SLEEP_INTERVAL = 60 # seconds, where we sleep in the main loop

class Plugin:
    def __init__(self):
        self.plugin_dir = os.path.dirname(os.path.realpath(__file__))
        self.data_file = os.path.join(self.plugin_dir, 'offline_time_data.json')
        self.current_game_id: Optional[str] = None
        self.session_start: Optional[float] = None
        self.is_tracking: bool = True
        self.offline_data: Dict[str, Dict] = self._load_data()
        self.last_network_check: float = 0
        self.was_offline: bool = False


    # Public API methods
    async def set_tracking_enabled(self, enabled: bool):
        """Enable or disable time tracking."""
        self.is_tracking = enabled
        if not enabled:
            await self._update_current_game(None)
        return {'success': True}

    async def get_offline_time(self, game_id: str) -> Dict:
        """Get offline time data for a specific game."""
        game_id_str = str(game_id)
        if game_id_str in self.offline_data:
            return self.offline_data[game_id_str]
        return {'total_seconds': 0, 'last_played': 0, 'sessions': []}

    async def get_all_offline_times(self) -> Dict:
        """Get offline time data for all games."""
        return self.offline_data

    async def clear_offline_data(self, game_id: Optional[str] = None):
        """Clear offline time data for a specific game or all games."""
        if game_id:
            game_id_str = str(game_id)
            if game_id_str in self.offline_data:
                del self.offline_data[game_id_str]
        else:
            self.offline_data = {}
        self._save_data()
        return {'success': True}


    # Private methods
    # Asyncio-compatible long-running code, executed in a task when the plugin is loaded
    async def _main(self):
        decky.logger.info("Offline Time Tracker plugin loaded")
        while True:
            try:
                current_time = time.time()
                
                # Check network status periodically (every CHECK_INTERVAL seconds)
                if current_time - self.last_network_check > CHECK_INTERVAL:
                    self.last_network_check = current_time
                    self.was_offline = await self._is_offline()
                    
                    # If we're offline and tracking is enabled, start/continue tracking
                    if self.was_offline and self.is_tracking:
                        current_game = await decky.get_current_game()
                        if current_game and current_game != self.current_game_id:
                            await self._update_current_game(current_game)
                    else:
                        await self._update_current_game(None)
                
                await asyncio.sleep(SLEEP_INTERVAL)
                
            except Exception as e:
                decky.logger.error(f"Error in main loop: {e}")
                await asyncio.sleep(5)  # Prevent tight loop on error
        self.loop = asyncio.get_event_loop()
        decky.logger.info("Hello World!")

    # Function called first during the unload process, utilize this to handle your plugin being stopped, but not
    # completely removed
    async def _unload(self):
        decky.logger.info("Goodnight World!")
        self._save_data()
        pass

    # Function called after `_unload` during uninstall, utilize this to clean up processes and other remnants of your
    # plugin that may remain on the system
    async def _uninstall(self):
        decky.logger.info("Goodbye World!")
        pass

    # Migrations that should be performed before entering `_main()`.
    async def _migration(self):
        decky.logger.info("Migrating")
        # Here's a migration example for logs:
        # - `~/.config/decky-template/template.log` will be migrated to `decky.decky_LOG_DIR/template.log`
        decky.migrate_logs(os.path.join(decky.DECKY_USER_HOME,
                                               ".config", "decky-template", "template.log"))
        # Here's a migration example for settings:
        # - `~/homebrew/settings/template.json` is migrated to `decky.decky_SETTINGS_DIR/template.json`
        # - `~/.config/decky-template/` all files and directories under this root are migrated to `decky.decky_SETTINGS_DIR/`
        decky.migrate_settings(
            os.path.join(decky.DECKY_HOME, "settings", "template.json"),
            os.path.join(decky.DECKY_USER_HOME, ".config", "decky-template"))
        # Here's a migration example for runtime data:
        # - `~/homebrew/template/` all files and directories under this root are migrated to `decky.decky_RUNTIME_DIR/`
        # - `~/.local/share/decky-template/` all files and directories under this root are migrated to `decky.decky_RUNTIME_DIR/`
        decky.migrate_runtime(
            os.path.join(decky.DECKY_HOME, "template"),
            os.path.join(decky.DECKY_USER_HOME, ".local", "share", "decky-template"))


    def _load_data(self) -> Dict:
        """Load offline time tracking data from JSON file."""
        try:
            if os.path.exists(self.data_file):
                with open(self.data_file, 'r') as f:
                    return json.load(f)
        except Exception as e:
            decky.logger.error(f"Error loading data: {e}")
        return {}

    def _save_data(self):
        """Save offline time tracking data to JSON file."""
        try:
            with open(self.data_file, 'w') as f:
                json.dump(self.offline_data, f, indent=2)
        except Exception as e:
            decky.logger.error(f"Error saving data: {e}")

    async def _is_offline(self) -> bool:
        """Check if the device is offline."""
        try:
            # Simple network check with a timeout
            reader, writer = await asyncio.wait_for(
                asyncio.open_connection('www.google.com', 80),
                timeout=0.5
            )
            writer.close()
            await writer.wait_closed()
            return False
        except (OSError, asyncio.TimeoutError):
            decky.logger.debug(f"Detected offline.")
            return True
        except Exception as e:
            decky.logger.error(f"Network check error: {e}")
            # Default to offline if we can't determine status
            return True

    async def _update_current_game(self, game_id: Optional[str]):
        """Update the current game being tracked."""
        current_time = time.time()
        
        # Save time for the previous game
        if self.current_game_id and self.session_start and self.was_offline:
            game_id_str = str(self.current_game_id)
            if game_id_str not in self.offline_data:
                self.offline_data[game_id_str] = {
                    'total_seconds': 0,
                    'last_played': 0,
                    'sessions': []
                }
            
            session_duration = current_time - self.session_start
            self.offline_data[game_id_str]['total_seconds'] += session_duration
            self.offline_data[game_id_str]['last_played'] = current_time
            self.offline_data[game_id_str]['sessions'].append({
                'start': self.session_start,
                'end': current_time,
                'duration': session_duration
            })
            
            # Keep only the last 100 sessions per game to prevent file bloat
            if len(self.offline_data[game_id_str]['sessions']) > 100:
                self.offline_data[game_id_str]['sessions'] = self.offline_data[game_id_str]['sessions'][-100:]
            
            self._save_data()
        
        # Update current game
        self.current_game_id = game_id
        self.session_start = current_time if game_id and self.is_tracking else None
