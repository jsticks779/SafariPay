import { Response } from 'express';

export class Responder {
    /**
     * @param res - Express Response object.
     * @param options - success, data, message, statusCode.
     */
    static send(res: Response, { success, data = {}, message = '', statusCode = 200 }:
        { success: boolean, data?: any, message?: string, statusCode?: number }) {

        return res.status(statusCode).json({
            success: success,
            data: data,
            message: message || (success ? 'Operation successful' : 'Operation failed')
        });
    }

    /** Shortcut for success responses */
    static ok(res: Response, data: any = {}, message: string = 'Success') {
        return this.send(res, { success: true, data, message, statusCode: 200 });
    }

    /** Shortcut for error responses */
    static error(res: Response, message: string = 'Internal server error', statusCode: number = 500) {
        return this.send(res, { success: false, data: {}, message, statusCode: statusCode });
    }
}
