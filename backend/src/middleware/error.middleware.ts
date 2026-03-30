import { Request, Response, NextFunction } from 'express';
import { Responder } from '../utils/responder';

export class ErrorMiddleware {
    /**
     * @param err - Error object.
     * @param req - Request object.
     * @param res - Response object.
     * @param next - Next function.
     */
    static handle(err: any, req: Request, res: Response, next: NextFunction) {
        console.error('🔥 [FATAL-ERROR-CENTRALIZED-HANDLER]');
        console.error('Time: ', new Date().toISOString());
        console.error('Message: ', err.message);
        console.error('Stack: ', err.stack);

        const statusCode = err.status || 500;
        const message = process.env.NODE_ENV === 'production'
            ? 'Internal server error'
            : err.message || 'Unknown error occurred';

        return Responder.error(res, message, statusCode);
    }
}
