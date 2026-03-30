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

export async function flushOfflineQueue(refreshCallback?: () => void) {
    if (!navigator.onLine) return;

    let queue: OfflineJob[] = JSON.parse(localStorage.getItem(OFFLINE_QUEUE_KEY) || '[]');
    if (queue.length === 0) return;

    // Filter only pending or previous failed attempts
    const pendingJobs = queue.filter(j => j.status === 'pending' || j.status === 'failed');
    if (pendingJobs.length === 0) return;

    console.log(`📡 [OFFLINE SYNC] Attempting to sync ${pendingJobs.length} transactions...`);
    let syncCount = 0;

    for (let job of queue) {
        if (job.status === 'synced') continue;

        job.status = 'syncing';
        localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));

        try {
            const res = await api.post(job.url, job.payload);
            job.status = 'synced';
            syncCount++;

            // SPECIAL CASE: If this was a registration, we got a token back!
            if (job.url.includes('/auth/register') && res.data?.data?.token) {
                const { user, token } = res.data.data;
                localStorage.setItem('sp_token', token);
                localStorage.setItem('sp_user', JSON.stringify(user));
                console.log('🔑 [OFFLINE SYNC] Registration synced & user authenticated');
            }

            console.log(`✅ [OFFLINE SYNC] Job ${job.id} synced successfully`);
        } catch (e: any) {
            job.status = 'failed';
            job.error = e.response?.data?.error || e.message || 'Unknown error';
            console.error(`❌ [OFFLINE SYNC] Job ${job.id} failed:`, job.error);
            // If it's a 4xx error, it's a conflict/bad request, we don't retry automatically
            // If it's 5xx or network, it will remain as 'failed' and retry next time
        }

        localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
    }

    // After a pass, we can clean up 'synced' items or keep them for history
    const remaining = queue.filter(j => j.status !== 'synced');
    localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(remaining));

    if (syncCount > 0) {
        toast.success(`Synced ${syncCount} transactions from offline storage!`, { icon: '🔄' });
        if (refreshCallback) refreshCallback();
    }
}

export function initOfflineSync() {
    window.addEventListener('online', () => {
        console.log('🌐 Internet is back! Starting background sync...');
        flushOfflineQueue();
    });

    // Check immediately if we have pending stuff
    if (navigator.onLine) {
        flushOfflineQueue();
    }
}

export function getOfflineTransactions(): OfflineJob[] {
    return JSON.parse(localStorage.getItem(OFFLINE_QUEUE_KEY) || '[]');
}
