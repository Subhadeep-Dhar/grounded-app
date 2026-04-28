import AsyncStorage from '@react-native-async-storage/async-storage';

const OFFLINE_QUEUE_KEY = 'offline_submission_queue';
const NETWORK_STATUS_KEY = 'network_status';

export const isOnline = async () => {
  try {
    const status = await AsyncStorage.getItem(NETWORK_STATUS_KEY);
    return status === 'online';
  } catch (error) {
    console.error('Error checking network status:', error);
    return true; // Assume online by default
  }
};

export const setNetworkStatus = async (online) => {
  try {
    await AsyncStorage.setItem(NETWORK_STATUS_KEY, online ? 'online' : 'offline');
  } catch (error) {
    console.error('Error setting network status:', error);
  }
};

export const addToQueue = async (submission) => {
  try {
    const queue = await getQueue();
    const newItem = {
      id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      ...submission,
      queuedAt: Date.now(),
      retryCount: 0,
    };
    
    queue.push(newItem);
    await AsyncStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
    
    console.log('Added to offline queue:', newItem.id);
    return newItem;
  } catch (error) {
    console.error('Error adding to queue:', error);
    throw error;
  }
};

export const getQueue = async () => {
  try {
    const queueJson = await AsyncStorage.getItem(OFFLINE_QUEUE_KEY);
    return queueJson ? JSON.parse(queueJson) : [];
  } catch (error) {
    console.error('Error getting queue:', error);
    return [];
  }
};

export const removeFromQueue = async (id) => {
  try {
    const queue = await getQueue();
    const filtered = queue.filter(item => item.id !== id);
    await AsyncStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(filtered));
    console.log('Removed from queue:', id);
  } catch (error) {
    console.error('Error removing from queue:', error);
    throw error;
  }
};

export const updateQueueItem = async (id, updates) => {
  try {
    const queue = await getQueue();
    const index = queue.findIndex(item => item.id === id);
    
    if (index !== -1) {
      queue[index] = { ...queue[index], ...updates };
      await AsyncStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
    }
    
    return queue[index];
  } catch (error) {
    console.error('Error updating queue item:', error);
    throw error;
  }
};

export const clearQueue = async () => {
  try {
    await AsyncStorage.removeItem(OFFLINE_QUEUE_KEY);
    console.log('Cleared offline queue');
  } catch (error) {
    console.error('Error clearing queue:', error);
    throw error;
  }
};

export const getQueueCount = async () => {
  try {
    const queue = await getQueue();
    return queue.length;
  } catch (error) {
    console.error('Error getting queue count:', error);
    return 0;
  }
};

export const processQueue = async (processFn) => {
  try {
    const queue = await getQueue();
    const online = await isOnline();
    
    if (!online || queue.length === 0) {
      return { processed: 0, failed: 0 };
    }
    
    let processed = 0;
    let failed = 0;
    
    for (const item of queue) {
      try {
        await processFn(item);
        await removeFromQueue(item.id);
        processed++;
      } catch (error) {
        console.error('Error processing queue item:', error);
        
        // Increment retry count
        const updated = await updateQueueItem(item.id, {
          retryCount: item.retryCount + 1,
          lastError: error.message,
        });
        
        // Remove after 3 retries
        if (updated.retryCount >= 3) {
          await removeFromQueue(item.id);
          failed++;
        }
      }
    }
    
    return { processed, failed };
  } catch (error) {
    console.error('Error processing queue:', error);
    return { processed: 0, failed: 0 };
  }
};

export const getQueueStatus = async () => {
  try {
    const queue = await getQueue();
    const online = await isOnline();
    
    return {
      online,
      pendingCount: queue.length,
      items: queue.map(item => ({
        id: item.id,
        queuedAt: new Date(item.queuedAt).toISOString(),
        retryCount: item.retryCount,
      })),
    };
  } catch (error) {
    console.error('Error getting queue status:', error);
    return { online: true, pendingCount: 0, items: [] };
  }
};