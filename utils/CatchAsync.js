module.exports = fn => {
    return (req, res, next) => {
        fn(req, res, next).catch(next);
        //.catch(next) without calling next() passes err automatically
        //same as .catch(err => next(err))
//since the fn is a promise we can use catch method available on all promises
    }
}
//here closure is used to wrap the function with arguments like req,res,next providing addition functionailities with .catch() method
//it will call fn which we passed into it and since it's an async function it'll return a promise

//asynchronous function is just a fulfilled promise which is resolved or rejected so you can use .catch() method on it

//sidenote
//always return next() if there's a res.status.json after that or else you'll receive two responses. one from next() and one from res.status.json

//never reassign arguments of a function with another value its a bad practice