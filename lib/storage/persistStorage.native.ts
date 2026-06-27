import { createJSONStorage } from 'zustand/middleware';

import { createChunkedSecureStore } from '@/lib/storage/secureStoreChunked';

/** Mobile: chunked SecureStore — supports large performance_logs + microcycle payloads. */
export const sommaPersistStorage = createJSONStorage(() => createChunkedSecureStore());
