const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config({path: './config.env'}); // MUST BE ABOVE APP so app has access to environment variables read

//To catch synchronous exceptions, MUST BE at top of main program to catch errors
// process.on('uncaughtException', err=>{
//     console.log('UNCAUGHT EXCEPTION! Shutting down')
//     console.log(err.name, err.message);
//     process.exit(1);
// })

const app = require('./app')

const DB = process.env.DATABASE.replace('<PASSWORD>', process.env.DATABASE_PASSWORD);

mongoose.connect(DB, {
    useNewUrlParser: true,
    useCreateIndex: true,
    useFindAndModify: false,
    useUnifiedTopology: true
}).then(()=>console.log("DB connection successful"));

const port = process.env.PORT || 3000;
const server = app.listen(port, () => {
    console.log(`App running on port ${port}`);
})

//Errors outside express like no connection to mongodb which are asynchronous due to rejected promises
process.on('unhandledRejection', err => {
    console.log(err.name, err.message);
    console.log('UNHANDLED REJECTION! Shutting down')
    //Gives server time to finish request and exits app
    server.close(() => {
        process.exit(1);
    })
  
})

//FACT WHEN WE GET ANY ERROR IN ANY MIDDLEWARE FUNCTION IT GOES TO GLOBAL ERROR HANDLER MIDDLEWARE

 