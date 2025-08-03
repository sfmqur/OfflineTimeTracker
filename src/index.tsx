import { 
  PanelSection, 
  PanelSectionRow, 
  Toggle, 
  Spinner,
  ScrollPanelGroup,
  ScrollPanelSection,
  ScrollPanelSectionHeader,
  DialogButton,
  DialogButtonPrimary,
  DialogButtonSecondary,
  DialogBodyText,
  DialogFooter,
  showModal,
  ProgressBarWithInfo
} from "@decky/ui";
import { FaTrash, FaInfoCircle, FaClock } from "react-icons/fa";
import { definePlugin, ServerAPI } from "@decky/api";
import { VFC, useEffect, useState } from "react";
import { formatDistanceToNow, intervalToDuration } from 'date-fns';

declare global {
  interface Window {
    DeckyPluginLoader: {
      callServerMethod: (method: string, params?: any) => Promise<{ success: boolean; result?: any }>;
    };
  }
}

// Type definitions for plugin data
interface GameTimeData {
  total_seconds: number;
  last_played: number;
  sessions: Array<{
    start: number;
    end: number;
    duration: number;
  }>;
}

type GameTimeMap = Record<string, GameTimeData>;

// Format seconds into human-readable time (e.g., "2h 30m 15s")
const formatTime = (seconds: number): string => {
  const duration = intervalToDuration({ start: 0, end: seconds * 1000 });
  const parts = [];
  
  if (duration.days) parts.push(`${duration.days}d`);
  if (duration.hours) parts.push(`${duration.hours}h`);
  if (duration.minutes || parts.length === 0) parts.push(`${duration.minutes || 0}m`);
  parts.push(`${duration.seconds || 0}s`);
  
  return parts.join(' ');
};

// Confirmation dialog component
const ConfirmDialog: VFC<{
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}> = ({ title, message, onConfirm, onCancel }) => (
  <div style={{ padding: '1em' }}>
    <DialogBodyText>{message}</DialogBodyText>
    <DialogFooter>
      <DialogButtonSecondary onClick={onCancel}>Cancel</DialogButtonSecondary>
      <DialogButtonPrimary onClick={onConfirm} style={{ backgroundColor: '#ff3c30' }}>
        {title}
      </DialogButtonPrimary>
    </DialogFooter>
  </div>
);

// Game time display component
const GameTimeItem: VFC<{ 
  gameId: string; 
  gameName: string; 
  timeData: GameTimeData;
  onClear: (gameName: string) => void;
}> = ({ gameName, timeData, onClear }) => {
  const lastPlayed = timeData.last_played 
    ? `Last played ${formatDistanceToNow(new Date(timeData.last_played * 1000), { addSuffix: true })}`
    : 'Never played';

  return (
    <div style={{ marginBottom: '1em' }}>
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: '0.5em'
      }}>
        <div style={{ fontWeight: 'bold' }}>{gameName}</div>
        <div style={{ fontSize: '0.9em', opacity: 0.8 }}>{lastPlayed}</div>
      </div>
      <div style={{ 
        display: 'flex', 
        alignItems: 'center',
        marginBottom: '0.5em'
      }}>
        <FaClock style={{ marginRight: '0.5em' }} />
        <div style={{ flexGrow: 1 }}>
          <div style={{ marginBottom: '0.25em' }}>
            {formatTime(timeData.total_seconds)}
          </div>
          <ProgressBarWithInfo 
            nProgress={Math.min(timeData.total_seconds / 3600, 100)} 
            sOperationText=""
          />
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <DialogButton 
          style={{ height: '30px', padding: '0 10px', minWidth: 'auto' }}
          onClick={() => onClear(gameName)}
        >
          <FaTrash style={{ marginRight: '5px' }} /> Clear
        </DialogButton>
      </div>
    </div>
  );
};

// Main plugin content component
const Content: VFC = () => {
  const [isTracking, setIsTracking] = useState<boolean>(true);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [gameTimes, setGameTimes] = useState<GameTimeMap>({});

  // Load initial data
  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true);
        const response = await window.DeckyPluginLoader.callServerMethod('get_all_offline_times');
        if (response.success) {
          setGameTimes(response.result || {});
        }
      } catch (e) {
        console.error('Failed to load game times', e);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, []);

  // Toggle tracking on/off
  const toggleTracking = async (enabled: boolean) => {
    try {
      const response = await window.DeckyPluginLoader.callServerMethod('set_tracking_enabled', { enabled });
      if (response.success) {
        setIsTracking(enabled);
      }
    } catch (e) {
      console.error('Failed to toggle tracking', e);
    }
  };

  // Clear game data
  const clearGameData = async (gameName?: string) => {
    try {
      const params = gameName ? { game_name: gameName } : {};
      const response = await window.DeckyPluginLoader.callServerMethod('clear_offline_data', params);
      if (response.success) {
        // Reload data after clearing
        const newData = await window.DeckyPluginLoader.callServerMethod('get_all_offline_times');
        if (newData.success) {
          setGameTimes(newData.result || {});
        }
      }
    } catch (e) {
      console.error('Failed to clear game data', e);
    }
  };

  // Handle clear button click
  const handleClearClick = (gameName: string) => {
    showModal(
      <ConfirmDialog
        title="Clear Data"
        message={`Are you sure you want to clear offline time data for ${gameName}?`}
        onConfirm={() => clearGameData(gameName)}
        onCancel={() => {}}
      />
    );
  };

  // Handle clear all button click
  const handleClearAllClick = () => {
    showModal(
      <ConfirmDialog
        title="Clear All Data"
        message="Are you sure you want to clear all offline time data? This cannot be undone."
        onConfirm={() => clearGameData()}
        onCancel={() => {}}
      />
    );
  };

  return (
    <ScrollPanelGroup>
      <ScrollPanelSection>
        <ScrollPanelSectionHeader>
          Tracking Status
        </ScrollPanelSectionHeader>
        <PanelSection>
          <PanelSectionRow>
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              width: '100%'
            }}>
              <span>Enable Offline Time Tracking</span>
              <Toggle
                value={isTracking}
                onChange={toggleTracking}
                disabled={isLoading}
              />
            </div>
          </PanelSectionRow>
          
          {isLoading ? (
            <PanelSectionRow style={{ display: 'flex', justifyContent: 'center' }}>
              <Spinner />
            </PanelSectionRow>
          ) : (
            <>
              <ScrollPanelSection>
                <ScrollPanelSectionHeader>
                  Tracked Games
                </ScrollPanelSectionHeader>
                {Object.entries(gameTimes).length > 0 ? (
                  Object.entries(gameTimes).map(([gameId, timeData]) => (
                    <GameTimeItem
                      key={gameId}
                      gameId={gameId}
                      gameName={gameId} // In a real implementation, you'd want to map this to the actual game name
                      timeData={timeData}
                      onClear={handleClearClick}
                    />
                  ))
                ) : (
                  <div style={{ textAlign: 'center', padding: '1em', opacity: 0.7 }}>
                    No offline game time tracked yet. Play a game while offline to see stats here.
                  </div>
                )}
              </ScrollPanelSection>
              
              {Object.keys(gameTimes).length > 0 && (
                <PanelSectionRow>
                  <DialogButton 
                    style={{ width: '100%', marginTop: '1em' }}
                    onClick={handleClearAllClick}
                  >
                    <FaTrash style={{ marginRight: '10px' }} />
                    Clear All Data
                  </DialogButton>
                </PanelSectionRow>
              )}
            </>
          )}
        </PanelSection>
      </ScrollPanelSection>
      
      <ScrollPanelSection>
        <ScrollPanelSectionHeader>
          About
        </ScrollPanelSectionHeader>
        <PanelSection>
          <div style={{ padding: '0.5em', opacity: 0.8, lineHeight: 1.5 }}>
            <p>
              <FaInfoCircle style={{ marginRight: '0.5em' }} />
              This plugin tracks your game time when playing offline. Time is only recorded when you're offline.
            </p>
          </div>
        </PanelSection>
      </ScrollPanelSection>
    </ScrollPanelGroup>
  );
};

export default definePlugin((serverApi: ServerAPI) => {
  // Make server API available globally for callbacks
  window.DeckyPluginLoader = {
    callServerMethod: (method: string, params?: any) => 
      serverApi.callPluginMethod(method, params || {})
    <div style={{ marginBottom: '1em' }}>
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: '0.5em'
      }}>
        <div style={{ fontWeight: 'bold' }}>{gameName}</div>
        <div style={{ fontSize: '0.9em', opacity: 0.8 }}>{lastPlayed}</div>
      </div>
      <div style={{ 
        display: 'flex', 
        alignItems: 'center',
        marginBottom: '0.5em'
      }}>
        <FaClock style={{ marginRight: '0.5em' }} />
        <div style={{ flexGrow: 1 }}>
          <div style={{ marginBottom: '0.25em' }}>
            {formatTime(timeData.total_seconds)}
          </div>
          <ProgressBarWithInfo 
            nProgress={Math.min(timeData.total_seconds / 3600, 100)} 
            sOperationText=""
          />
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <DialogButton 
          style={{ height: '30px', padding: '0 10px', minWidth: 'auto' }}
          onClick={() => onClear(gameId)}
        >
          <FaTrash style={{ marginRight: '5px' }} /> Clear
        </DialogButton>
      </div>
    </div>
  );
};

const Content: VFC = () => {
  const [isTracking, setIsTracking] = useState<boolean>(true);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [gameTimes, setGameTimes] = useState<GameTimeMap>([]);
  const [showClearAllConfirm, setShowClearAllConfirm] = useState<boolean>(false);
  const [gameToClear, setGameToClear] = useState<string | null>(null);

  const loadTrackingStatus = async () => {
    try {
      const response = await window.DeckyPluginLoader.callServerMethod('get_all_offline_times');
      if (response.success) {
        setGameTimes(response.result || {});
      }
    } catch (e) {
      console.error('Failed to load tracking data', e);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleTracking = async (enabled: boolean) => {
    try {
      const response = await window.DeckyPluginLoader.callServerMethod('set_tracking_enabled', { enabled });
      if (response.success) {
        setIsTracking(enabled);
      }
    } catch (e) {
      console.error('Failed to toggle tracking', e);
    }
  };

  const clearGameData = async (gameId?: string) => {
    try {
      const response = await window.DeckyPluginLoader.callServerMethod('clear_offline_data', { gameId });
      if (response.success) {
        await loadTrackingStatus();
      }
    } catch (e) {
      console.error('Failed to clear game data', e);
    }
  };

  const handleClearClick = (gameId: string, gameName: string) => {
    setGameToClear(gameId);
    showModal(
      <ConfirmClearDialog 
        gameName={gameName}
        onConfirm={() => {
          clearGameData(gameId);
          setGameToClear(null);
        }}
        onCancel={() => setGameToClear(null)}
      />
    );
  };

  const handleClearAllClick = () => {
    setShowClearAllConfirm(true);
    showModal(
      <ConfirmClearDialog 
        onConfirm={() => {
          clearGameData();
          setShowClearAllConfirm(false);
        }}
        onCancel={() => setShowClearAllConfirm(false)}
      />
    );
  };

  useEffect(() => {
    loadTrackingStatus();
  }, []);

  return (
    <ScrollPanelGroup>
      <ScrollPanelSection>
        <ScrollPanelSectionHeader>
          Tracking Status
        </ScrollPanelSectionHeader>
        <PanelSection>
          <PanelSectionRow>
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              width: '100%'
            }}>
              <span>Enable Offline Time Tracking</span>
              <Toggle
                value={isTracking}
                onChange={toggleTracking}
                disabled={isLoading}
              />
            </div>
          </PanelSectionRow>
          
          {isLoading ? (
            <PanelSectionRow style={{ display: 'flex', justifyContent: 'center' }}>
              <Spinner />
            </PanelSectionRow>
          ) : (
            <React.Fragment>
              <PanelSectionRow>
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center',
                  fontSize: '0.9em',
                  color: '#a9a9a9',
                  marginBottom: '1em'
                }}>
                  <FaInfoCircle style={{ marginRight: '0.5em' }} />
                  Time is only tracked when offline and this setting is enabled
                </div>
              </PanelSectionRow>
              
              <PanelSectionRow>
                <ButtonItem
                  layout="below"
                  onClick={handleClearAllClick}
                  disabled={Object.keys(gameTimes).length === 0}
                  style={{ marginTop: '1em' }}
                >
                  <FaTrash style={{ marginRight: '0.5em' }} />
                  Clear All Data
                </ButtonItem>
              </PanelSectionRow>
            </React.Fragment>
          )}
        </PanelSection>
      </ScrollPanelSection>

      <ScrollPanelSection>
        <ScrollPanelSectionHeader>
          Tracked Games
        </ScrollPanelSectionHeader>
        <PanelSection>
          {isLoading ? (
            <PanelSectionRow style={{ display: 'flex', justifyContent: 'center' }}>
              <Spinner />
            </PanelSectionRow>
          ) : Object.keys(gameTimes).length === 0 ? (
            <PanelSectionRow>
              <div style={{ 
                textAlign: 'center', 
                color: '#a9a9a9',
                padding: '1em 0'
              }}>
                No offline playtime data available yet.
              </div>
            </PanelSectionRow>
          ) : (
            Object.entries(gameTimes).map(([gameId, timeData]) => (
              <PanelSectionRow key={gameId}>
                <GameTimeItem 
                  gameId={gameId}
                  gameName={gameId} // In a real app, you'd want to look up the game name
                  timeData={timeData}
                  onClear={handleClearClick}
                />
              </PanelSectionRow>
            ))
          )}
        </PanelSection>
      </ScrollPanelSection>
    </ScrollPanelGroup>
  );
};

export default definePlugin((serverApi: ServerAPI) => {
  // Initialize plugin
  serverApi.routerHook.addRoute("/offline-time-tracker", Content);

  // Clean up on unmount
  return () => {
    serverApi.routerHook.removeRoute("/offline-time-tracker");
    // The function triggered when your plugin unloads
    onDismount() {
      console.log("Unloading")
    },
  };
});
