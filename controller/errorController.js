const AppError = require('./../utils/AppError');

//Turns error from mongoose into operational error
const handleCastErrorDB = err => {
    const message = `Invalid ${err.path}: ${err.value}.`
    return new AppError(message, 400);
}

const handleDuplicateFieldsDB = err => {
    const value = err.errmsg.match(/(["'])(\\?.)*?\1/)[0];
    const message = `Duplicate field value ${value}, Please use another value`;
    return new AppError(message, 400);
}

const handleValidationErrorDB = err => {
    const errors = Object.values(err.errors).map(el => el.message);
    const message = `Invalid input data. ${errors.join('. ')}`;
    return new AppError(message, 400);
}

const sendErrorDev = (err, res) => {
    res.status(err.statusCode).json({
        status: err.status,
        error: err,
        message: err.message,
        stack: err.stack
    })
}

const handleJWTError = () => new AppError('Invalid token, Please log in again', 401);

const handleJWTExpiredError = () => new AppError('Your token has expired! Please log in again', 401);

const sendErrorProd = (err, res) => {
    //Operational trusted error: send message to client
    if (err.isOperational) {
        res.status(err.statusCode).json({
            status: err.status,
            message: err.message,
        })
    //Programming or other unknown error: don't leak error details
    } else {
        // 1)log error
        console.error('ERROR', err);

        // 2) Send generic message 
        res.status(500).json({
            status: 'error',
            message: 'Something went wrong'
        })
    }
}

module.exports = (err, req, res, next) => {
    err.statusCode = err.statusCode || 500;  //if error status code is defined else 500
    err.status = err.status || 'error'  //if error status is defined else error

    if (process.env.NODE_ENV === 'development'){
        sendErrorDev(err, res);
    } else if(process.env.NODE_ENV === 'production'){
        let error = {...err}
        if (err.name === 'CastError')  error = handleCastErrorDB(error)  //mongoose can't cast id field for e.g tours/wwwwww
        console.log(error);
        if (error.code === 11000) error = handleDuplicateFieldsDB(error); //mongoose duplicate fields which are supposed to be unique thrown by mongoose for e.g for post requests "The forest hiker" with two names

        if(err.name === 'ValidationError') error = handleValidationErrorDB(error);
        
        if(err.name === 'JsonWebTokenError') error = handleJWTError();
        
        if(err.name === 'TokenExpiredError') error = handleJWTExpiredError();
        
        sendErrorProd(error, res);
    }

}