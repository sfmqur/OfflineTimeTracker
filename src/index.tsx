import * as React from 'react';
import { VFC, useEffect, useState } from 'react';
import { definePlugin } from '@decky/api';
import { 
  PanelSection, 
  PanelSectionRow, 
  Toggle, 
  Spinner,
  DialogButton,
  DialogButtonPrimary,
  DialogButtonSecondary,
  DialogBodyText,
  DialogFooter,
  showModal,
  ProgressBarWithInfo,
  ButtonItem,
  staticClasses
} from '@decky/ui';
import { FaTrash, FaInfoCircle, FaClock } from 'react-icons/fa';

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
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0 || parts.length === 0) parts.push(`${minutes}m`);
  parts.push(`${secs}s`);
  
  return parts.join(' ');
};

// Format relative time (e.g., "2 hours ago")
const formatRelativeTime = (timestamp: number): string => {
  const now = Date.now() / 1000;
  const diff = now - timestamp;
  
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)} minutes ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} hours ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)} days ago`;
  if (diff < 2592000) return `${Math.floor(diff / 604800)} weeks ago`;
  if (diff < 31536000) return `${Math.floor(diff / 2592000)} months ago`;
  return `${Math.floor(diff / 31536000)} years ago`;
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
  onClear: (gameId: string) => void;
}> = ({ gameId, gameName, timeData, onClear }) => {
  const lastPlayed = timeData.last_played 
    ? `Last played ${formatRelativeTime(timeData.last_played)}`
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
          onClick={() => onClear(gameId)}
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
          
          // Get current tracking status
          const status = await window.DeckyPluginLoader.callServerMethod('get_tracking_status');
          if (status.success) {
            setIsTracking(status.result?.enabled ?? true);
          }
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
  const clearGameData = async (gameId?: string) => {
    try {
      const params = gameId ? { game_id: gameId } : {};
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
  const handleClearClick = (gameId: string) => {
    const gameName = Object.keys(gameTimes).includes(gameId) ? gameId : 'this game';
    showModal(
      <ConfirmDialog
        title="Clear Data"
        message={`Are you sure you want to clear offline time data for ${gameName}?`}
        onConfirm={() => clearGameData(gameId)}
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
    <div>
      <PanelSection title="Tracking Status">
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
            <PanelSectionRow>
              <div style={{ display: 'flex', justifyContent: 'center', width: '100%' }}>
                <Spinner />
              </div>
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
                <div style={{ marginTop: '1em', width: '100%' }}>
                  <ButtonItem
                    layout="below"
                    onClick={handleClearAllClick}
                    disabled={Object.keys(gameTimes).length === 0}
                  >
                    <FaTrash style={{ marginRight: '0.5em' }} />
                    Clear All Data
                  </ButtonItem>
                </div>
              </PanelSectionRow>
            </React.Fragment>
          )}
        </PanelSection>
        
        <PanelSection title="Tracked Games">
          {isLoading ? (
            <PanelSectionRow>
              <div style={{ display: 'flex', justifyContent: 'center', width: '100%' }}>
                <Spinner />
              </div>
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
    </div>
  );
};

export default definePlugin(() => {
  console.log("Offline Time Tracker plugin initializing, this is called once on frontend startup");


  return {
    name: "Offline Time Tracker",
    titleView: <div className={staticClasses.Title}>Offline Time Tracker</div>,
    content: <Content />,
    icon: <FaClock />,
    onDismount: () => {
      console.log("Unloading Offline Time Tracker plugin");
    },
  };
});
