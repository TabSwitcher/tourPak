class AppError extends Error {
    constructor(message, statusCode) {
        //We use super to call parent class constructor
        //Whatever we pass in super is gonna be the msg property no need to separately assign
        super (message);
        this.statusCode = statusCode;
        this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
        this.isOperational = true; //would help us to differentiate between operational and programming errors 
        //we can use this property to send only operational errors to client

        //function call wont come in stack trace and pollute it
        Error.captureStackTrace(this, this.constructor); 
    }
}

module.exports = AppError;