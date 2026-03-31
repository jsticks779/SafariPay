import api from './api';
import toast from 'react-hot-toast';

export const OFFLINE_QUEUE_KEY = 'sp_offline_tx_queue';

export interface OfflineJob {
    id: string;
    url: string;
    payload: any;
    timestamp: number;
    status: 'pending' | 'syncing' | 'synced' | 'failed';
    error?: string;
}

export function queueOfflineTransaction(url: string, payload: any) {
    const existing: OfflineJob[] = JSON.parse(localStorage.getItem(OFFLINE_QUEUE_KEY) || '[]');

    // Create a robust job object
    const job: OfflineJob = {
        id: `tx_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        url,
        payload: {
            ...payload,
            client_ref: `offline_${Date.now()}` // Idempotency key for backend
        },
        timestamp: Date.now(),
        status: 'pending'
    };

    existing.push(job);
    localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(existing));

    // Notify the user in their preferred language (defaulting to English)
    toast.success('Transaction saved offline. Will sync when internet returns!');
}

let isSyncing = false;

export async function flushOfflineQueue(refreshCallback?: () => void) {
    if (!navigator.onLine || isSyncing) return;

    let queue: OfflineJob[] = JSON.parse(localStorage.getItem(OFFLINE_QUEUE_KEY) || '[]');
    if (queue.length === 0) return;

    // Filter only pending or previous failed attempts
    const pendingJobs = queue.filter(j => j.status === 'pending' || j.status === 'failed');
    if (pendingJobs.length === 0) {
        // Clean up any stray synced items
        const remaining = queue.filter(j => j.status !== 'synced');
        localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(remaining));
        return;
    }

    isSyncing = true;
    console.log(`📡 [OFFLINE SYNC] Starting sync cycle for ${pendingJobs.length} transactions...`);
    let syncCount = 0;

    try {
        for (let job of queue) {
            if (job.status === 'synced' || job.status === 'syncing') continue;

            job.status = 'syncing';
            localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));

            try {
                // IMPORTANT: We use a POST request. The backend SHOULD handle idempotency via client_ref
                const res = await api.post(job.url, job.payload);
                job.status = 'synced';
                syncCount++;

                if (job.url.includes('/auth/register') && res.data?.data?.token) {
                    const { user, token } = res.data.data;
                    localStorage.setItem('sp_token', token);
                    localStorage.setItem('sp_user', JSON.stringify(user));
                }

                console.log(`✅ [OFFLINE SYNC] Job ${job.id} synced`);
            } catch (e: any) {
                job.status = 'failed';
                job.error = e.response?.data?.error || e.message || 'Unknown error';
                console.error(`❌ [OFFLINE SYNC] Job ${job.id} failed:`, job.error);
                
                // Stop syncing further if we hit a serious error (except 409/400)
                if (e.response?.status >= 500) break;
            }

            localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
        }

        // Cleanup
        const remaining = queue.filter(j => j.status !== 'synced');
        localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(remaining));

        if (syncCount > 0) {
            toast.success(`Synced ${syncCount} transactions!`, { icon: '🔄' });
            if (refreshCallback) refreshCallback();
        }
    } finally {
        isSyncing = false;
        console.log('🏁 [OFFLINE SYNC] Cycle complete.');
    }
}

export function initOfflineSync() {
    // Only register once
    if ((window as any).__sp_sync_init) return;
    (window as any).__sp_sync_init = true;

    window.addEventListener('online', () => {
        console.log('🌐 Online! Syncing...');
        flushOfflineQueue();
    });

    // Check immediately
    if (navigator.onLine) {
        flushOfflineQueue();
    }
}

export function getOfflineTransactions(): OfflineJob[] {
    const queue: OfflineJob[] = JSON.parse(localStorage.getItem(OFFLINE_QUEUE_KEY) || '[]');
    return queue.filter(j => j.status === 'pending' || j.status === 'failed');
}
