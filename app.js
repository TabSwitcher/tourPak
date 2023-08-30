const express = require('express');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const mongoSanitize = require('express-mongo-sanitize'); 
const xss = require('xss-clean');
const hpp = require('hpp');

const morgan = require('morgan');
const AppError = require('./utils/AppError');
const globalErrorHandler = require('./controller/errorController')
const tourRouter = require('./routes/tourRoutes');
const userRouter = require('./routes/userRoutes');
const reviewRouter = require('./routes/reviewRoutes');

const app = express();
//1)GLOBAL MIDDLEWARES
//Set Security HTTP headers
app.use(helmet())

//Development logging
if(process.env.NODE_ENV === 'development'){
    app.use(morgan('dev'));
}

//Limit requests from same API
const limiter = rateLimit({
    max: 100,
    windowMs: 60 * 60 * 1000,  //1 hundred request in 1 hour, this one is in milliseconds
    message: 'Too many request from this IP, please try again later'
});

app.use('/api', limiter); //limit only the api route

//Body parser, reading data from body into req.body
app.use(express.json({ limit: '10kb' })); //a body larger than 10kb wont be accepted

//Data sanitization against NoSQL query injection
app.use(mongoSanitize());

//Data sanitization against XSS (prevent malicious html code)
app.use(xss());

//Prevent parameter pollution, should be used later than above
app.use(hpp({
    whiteList: [
        'duration', 
        'ratingsQuantity', 
        'ratingsAverage', 
        'maxGroupSize', 
        'difficulty', 
        'price'
    ] 
//parameters which are allowed to be duplicated
}));

//serving sattic files
app.use(express.static(`${__dirname}/public`));


// Test middleware
app.use((req, res, next) => {
    req.requestTime = new Date().toISOString();
//    console.log(req.headers);
    next();
})

//ROUTES
app.use('/api/v1/tours', tourRouter);
app.use('/api/v1/users', userRouter);
app.use('/api/v1/reviews', reviewRouter);

//.all applies to all methods get post etc and * means for all routes
//when we dont get a response bcz we specified an another url not defined in routers therefore with no handlers
app.all('*', (req, res, next) => {

    // res.status(404).json({
    //     status: 'fail',
    //     message: `Can't fine ${req.originalUrl} on this server`
    // })

    // const err = new Error(`Can't fine ${req.originalUrl} on this server`);
    // err.status = 'fail';
    // err.statusCode = 404;

    //express assumes whatever we pass to next is an error
    //it will then skip all other middlewares and send it to global error handling middleware
    next(new AppError(`Can't fine ${req.originalUrl} on this server`, 404));
})

//4 parameters express automatically knows this func is error handling middleware
app.use(globalErrorHandler);
module.exports = app;


//SECRET RECIPE FOR FORMATTING npm i eslint prettier eslint-config-prettier eslint-plugin-prettier eslint-config-airbnb eslint-plugin-node eslint-plugin-import eslint-plugin-jsx-a11y eslint-plugin-react --save-dev