const { promisify } = require('util');
const jwt = require('jsonwebtoken');
const User = require('./../models/userModel');
const catchAsync = require('./../utils/CatchAsync');
const AppError = require('./../utils/AppError');
const sendEmail = require('./../utils/Email');
const crypto = require('crypto');

const signToken = id => {
//First argument is payload (any data we want to store) 2nd is secret key and third is an token expiry date passed in object
// {{ id }} = {id: newUser._id}   
    return jwt.sign({ id }, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRES_IN
    });
}

const createSendToken = (user, statusCode, res) => {
    const token = signToken(user._id);

    const cookieOptions = {
 //We didn't set ENV var to 90d and just 90 bcz we wanted calculation to be performed
        expires: new Date(Date.now() + process.env.JWT_COOKIE_EXPIRES_IN * 24 * 60 * 60 * 1000),
//       secure: true, //HTTP only cookie send
        httpOnly: true //Cookie cant be accessed or edited by browser
    }
    if (process.env.NODE_ENV === 'production') cookieOptions.secure = true;

    //removes the password from the output
    user.password = undefined;

    res.cookie('jwt', token, cookieOptions);

    res.status(statusCode).json({
        status: 'success',
        token,
        data: {
            user
        }
    })
}

exports.signup = catchAsync(async (req, res, next) => {
//For security reasons we don't use User.create(req.body) as anyone can pass themselves as admin
    const newUser = await User.create(req.body);

// const newUser = await User.create({
    //     name: req.body.name,
    //     email: req.body.email,
    //     password: req.body.password,
    //     passwordConfirm: req.body.passwordConfirm,
    //     passwordChangedAt: passwordChangedAt
    // });
    createSendToken(newUser, 201, res);
});

exports.login = catchAsync(async(req, res, next) => {
    const { email, password } = req.body;

    //1) Check if email and password exists

    //Use return before next to avoid sending 2 responses
    if (!email || !password) {
        return next(new AppError('Please provide email and password'), 400);
    }

    //2) Check if user exits && password is correct
    //as password isnt selected by default, we need to explicitly select it by adding + before its name
    const user = await User.findOne({ email }).select('+password');
      //console.log(user);

      
    //('pass1234') === '$2a$12$ffVRb7NB8vtQGjI86/jB1epgf1hu47o37OjKLXwAD1ZjKGFKD7Zdi'
    //do in models

    //if user doesn't it wont go after || block and check passwords
    if(!user || !(await user.correctPassword(password, user.password))) {
        return next(new AppError('Incorrect email or password', 401));
    }

    //3)If everything ok, send token to Client
    createSendToken(user, 200, res);
});


exports.protect = catchAsync(async (req, res, next) => {
    //1) Getting token and check if it's there

//{ example request header we put Bearer at front of value of token
//   authorization: 'Bearer kdjdjdj',
//   'user-agent': 'PostmanRuntime/7.31.3',
// }
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')){
        token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
        return next(new AppError('You are not logged in! Please log in to get access', 401));
    };

    //2) Verification token

    //promisify(jwt.verify) all this here is a function which returns a promise when called and just after that (token, promise.env.JWT_SECRET) just calls the function with args

    const decoded = await promisify(jwt.verify)(token, process.env.JWT_SECRET)
    
    //decoded returns an object with user id which logged in
    //3) Check if user still exists
    const currentUser = await User.findById(decoded.id)
    if (!currentUser) {
        return next(new AppError('The user belonging to this token no longer exists', 401))
    };

    //4) Check if user changed password after the token was issued
    if (currentUser.changedPasswordAfter(decoded.iat)) {
        return next(new AppError('User recently changed password! Please log in again', 401));
    }

    //GRANT ACCESS TO PROTECTED ROUTE
    req.user = currentUser; //crucial to send to next middleware for .restrictTO
    next();
});

//Here we need to pass arguments to middleware function but we can't so we create a wrapper func

exports.restrictTo = (...roles) => {
    return (req, res, next) => {
        //roles ['admin', 'lead-guide']
        if (!roles.includes(req.user.role)) {
            return next(new AppError('You donot have permission to perform this action', 403));
        }
        next();
    };
};

exports.forgotPassword = catchAsync(async(req, res, next) => {
    //1)Get user based on POSTed email

    const user = await User.findOne({ email: req.body.email })
    if (!user) {
        return next(new AppError('There is no user with that email address', 404));
    }

    //2)Generate the random reset token
    const resetToken = user.createPasswordResetToken(); //We just created document but didn't save
    await user.save({ validateBeforeSave: false }); //Here we save it turn off validation to hide a bunch of validation errors (like missing name, pass) if u only enter email in post request
    //3)Send it to user's email

    //req.get('host') will work both in development and production
    const resetURL = `${req.protocol}://${req.get(
        'host'
        )}/api/v1/users/resetPassword/${resetToken}`;
//IMPORTANT, HERE THE TOKEN SENT IN URL IS NON-ENCRYPTED BUT THE ONE STORED IN DATABASE IS ENCRYPTED

    const message = `Forgot your password? Submit a PATCH request with your new password and passwordConfirm to: ${resetURL}.\n If you didn't forget your password, please ignore this email`;
    
    try {
        await sendEmail({
            email: user.email,
            subject: 'Your password reset token (Valid for 10 mins)',
            message
        }) 
   

    res.status(200).json({
        status: 'success',
        message: 'Token sent to email!'
    })
    } catch(err) {
        //if error occurs reset token and expired property
        user.passwordResetToken = undefined;
        user.passwordResetExpires = undefined;
        await user.save({ validateBeforeSave: false });
        return next(
            new AppError('There was an error sending the email. Try again later', 
            500));
    }
});



exports.resetPassword = catchAsync(async (req, res, next) => {
    //1) Get user based on the token

    const hashedToken = crypto
        .createHash('sha256')
        .update(req.params.token)
        .digest('hex');
    
    //only thing that can identify user is token, so we query using it
    
    //check if token not expired by comparing reset time to be always greater than current time
    const user = await User.findOne({ passwordResetToken: hashedToken, passwordResetExpires: { $gt: Date.now() } });
//2) If token has not expired, and there is user, set the new password
    if (!user){
        return next(new AppError('Token is invalid or has expired',  400));
    }
    user.password = req.body.password;
    user.passwordConfirm = req.body.passwordConfirm;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;

    await user.save(); //here we want to validate so wont turn em off


    //3) Updated changedPasswordAt property for the user

    //4) Log the user in, send JWT to client
    createSendToken(user, 200, res);
});

exports.updatePassword = catchAsync(async (req, res, next) => {
    //1) Get user from collection
    const user = await User.findById(req.user.id).select('+password');

    //2) Check if POSTed password is correct
    if (!await user.correctPassword(req.body.passwordCurrent, user.password)){
        return next(new AppError('Your current password is wrong', 401));
    }

    //3) If so, update password
    user.password = req.body.password;
    user.passwordConfirm = req.body.passwordConfirm;

    await user.save(); //User.findByIdAndUpdate wont work

    //4) Log user in, send JWT to user
    createSendToken(user, 200, res);
});