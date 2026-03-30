// Hackathon Fallback: In-memory cache simulating Redis
const memoryMap = new Map<string, { value: string, expiresAt: number }>();

export const redisClient = {
    get: async (key: string) => {
        const data = memoryMap.get(key);
        if (!data) return null;
        if (data.expiresAt < Date.now()) {
            memoryMap.delete(key);
            return null;
        }
        return data.value;
    },
    setex: async (key: string, seconds: number, val: string) => {
        memoryMap.set(key, { value: val, expiresAt: Date.now() + (seconds * 1000) });
    },
    del: async (key: string) => {
        memoryMap.delete(key);
    }
};

console.log('✅ In-memory Cache connected (Simulating Redis for Alpha Sandbox)');
