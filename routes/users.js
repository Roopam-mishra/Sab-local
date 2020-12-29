const router = require('express').Router();
const bcrypt = require('bcryptjs');
const passport = require('passport');

const { forwardAuthenticated } = require('../config/auth.js');
const { ensureAuthenticated } = require('../config/auth.js');

const User = require('../models/User');
const Shopowner = require('../models/Shopowner');
const Donation = require('../models/Donation');
const Contact = require('../models/Contact');


const bodyParser = require('body-parser');
let urlencodedParser = bodyParser.urlencoded({ extended: false });
const fast2sms = require('fast-two-sms');

// Index page
router.get('/' , (req , res) => res.render('index' , {user: req.user}));

// Register Page
router.get('/formregister', (req, res) => res.render('formregister'));

// Login Page
router.get('/formlogin', forwardAuthenticated , (req, res) => res.render('formlogin'));

// Add Shop Page
router.get('/formaddshop', ensureAuthenticated, (req, res) => res.render('formaddshop'));

// Donation Page
router.get('/formdonate', (req, res) => res.render('formdonate'));

// MyShop page
router.get('/myshop' , ensureAuthenticated , (req , res) => {
    Shopowner.find({email: req.user.email} , (err , data) => {
        if(err) throw err;
        res.render('myshop' , {data: data,user:req.user});
    });
});



/***************************** User Registration *****************************/
router.post('/formregister', (req, res) => {
    const { name, email, phone, gender, age, password, password2 } = req.body;
    // console.log(req.body.name);
    // console.log(req.body.email);
    // console.log(req.body.phone);
    // console.log(req.body.gender);
    // console.log(req.body.age);
    // console.log(req.body.password);
    // console.log(req.body.password2);

    let errors = [];

    // Check required fields
    if(!name || !email || !phone || !gender || !age || !password || !password2 ){
        errors.push({msg: 'Please fill in all fields'});
    }

    // check Passwords Match
    if(password!=password2)
    {
        errors.push({msg:' Passwords do not match'});
    }

    //check password length
    if (password.length < 6) {
        errors.push({ msg: 'Password must be at least 6 characters' });
    }

    if (errors.length > 0) {
        res.render('formregister', {
            errors,
            name,
            email,
            phone,
            gender,
            age,
            password,
            password2
        });
    }
    else{
        //Validation pass
        User.findOne({email: email}).then(user=>{
            if(user)
            {
                //User exists
                errors.push({msg: 'Email is already registered'});
                res.render('formregister', {
                    errors,
                    name,
                    email,
                    phone,
                    gender,
                    age,
                    password,
                    password2
                });
            }
            else
            {
                const newUser = new User({
                    name,
                    email,
                    phone,
                    gender,
                    age,
                    password
                });

                // Hash Password
                bcrypt.genSalt(10, (err, salt) =>{
                    bcrypt.hash(newUser.password, salt, (err, hash) => {
                        if (err) throw err;
                        // Set password to hashed
                        newUser.password = hash;
                        //Save user
                        newUser.save()
                        .then(user => {
                            req.flash(
                                'success_msg',
                                'You are now registered and can log in'
                              );
                            res.redirect('/formlogin');
                        })
                        .catch(err => console.log(err));
                    });
                });
            }
        });
    }
});


/***************************** User Login *****************************/
router.post('/formlogin', (req, res, next) => {
    passport.authenticate('local', {
      successRedirect: '/',
      successFlash: true,
      failureRedirect: '/formlogin',
      failureFlash: true
    })(req, res, next);
});


/***************************** User Logout *****************************/
router.get('/logout', (req, res) => {
    req.logout();
    req.flash(
        'error',
        'You are logged out'
      );
    res.redirect('/');
});


/***************************** Register Shop *****************************/
router.post('/formaddshop',ensureAuthenticated, (req, res) =>{
    // console.log(req.user);
    const { shopname, ownername,  shoptype, donationwant, aboutshop, pincode, area } = req.body;
    // console.log(req.body.shopname);
    // console.log(req.body.ownername);
    // console.log(req.body.shoptype);
    // console.log(req.body.donationwant);
    // console.log(req.body.aboutshop);
    // console.log(req.body.pincode);
    // console.log(req.body.area);
    let errors = [];

    if (!shopname || !ownername || !shoptype || !donationwant || !aboutshop || !pincode || !area)
    {
        errors.push({ msg: 'Please enter all fields' });
    }
    else if(pincode.length != 6) 
    {
        errors.push({msg: "Please enter valid Pincode"});
    }
    if (errors.length > 0) {
        res.render('formaddshop', {
            errors,
            shopname,
            ownername,
            shoptype,
            donationwant,
            aboutshop,
            pincode,
            area
        });
    }
    else
    {
        Shopowner.findOne({ pincode:pincode,area:area,shopname:shopname }).then(shopowner =>
        {
            if (shopowner)
            {
                errors.push({ msg: 'Shop already exists' });
                res.render('formaddshop', {
                    errors,
                    shopname,
                    ownername,
                    shoptype,
                    donationwant,
                    aboutshop,
                    pincode,
                    area
                });
            }
            else
            {
                //console.log(req.user);
                req.user.addShop = true;
                req.user.save();
                //console.log(req.user);
                const newShopowner = new Shopowner({
                    email: req.user.email,
                    shopname,
                    ownername,
                    shoptype,
                    donationwant,
                    aboutshop,
                    pincode,
                    area,
                });
                newShopowner.save().then(shopowner=>{
                    req.flash(
                        'success_msg',
                        'Your shop has been registered successfully'
                      );
                    res.redirect('/');
                })
                .catch(err => console.log(err));
            }
        });
    }
});


/***************************** Donation Form *****************************/
router.post('/formdonate', (req, res) => {
    const { donorname, ownername, shopname, pincode, area, amount} = req.body;
    // console.log(req.body.donorname);
    // console.log(req.body.ownername);
    // console.log(req.body.shopname);
    // console.log(req.body.pincode);
    // console.log(req.body.area);
    // console.log(req.body.amount);
    let errors = [];

    // Check required fields
    if( !donorname || !ownername || !shopname || !amount || !pincode || !area ){
        errors.push({msg:' Please fill in all fields'});
    }

    if (errors.length > 0) {
        res.render('formdonate', {
            errors,
            donorname,
            ownername,
            shopname,
            pincode,
            area,
            amount
        });
    }
    else{
        //Validation pass
        Shopowner.findOne({shopname: shopname}).then(donation=>{
            if(donation){
                const newDonation = new Donation({
                    donorname,
                    ownername,
                    shopname,
                    pincode,
                    area,
                    amount
                });
                newDonation.save()
                .then(donation => {
                    req.flash(
                        'success_msg',
                        'Your request for donation has been sent successfully'
                    );
                    res.redirect('/');
                })
                .catch(err => console.log(err))
            }
            else{
                //Shop is not registered
                errors.push({msg: 'Shop is not registered'});
                res.render('formdonate', {
                    errors,
                    donorname,
                    ownername,
                    shopname,
                    pincode,
                    area,
                    amount
                });
            }
        });
    }
});


/***************************** Pincode Filter *****************************/
router.post('/filterpincode',function(req,res)
{
    const pincode = req.body.pincode;
    //console.log(req.body.pincode);

    let errors=[];

    if (!pincode)
    {
        errors.push({ msg: 'Please enter Pincode' });
    }

    else if(pincode.length != 6) 
    {
        errors.push({msg: "Please enter a valid Pincode"});
    }

    if (errors.length > 0) {
        res.render('index', {
            errors,
            pincode,
        });
    }
    else{
        Shopowner.find({pincode:req.body.pincode},function(err,data)
        {
            if(err)
            {
                errors.push({ msg: 'Not able to process the Pincode you entered' });
                res.render('index', {
                    errors,
                    pincode,
                });
                process.exit(1);
            }
            //console.log(data.length);
            let set=new Set();
            for(let i=0;i<data.length;i++)
            {
                set.add(data[i].area);
            }
            let pcode={
                pc:req.body.pincode
            };
            let val=Array.from(set);
            val.sort();
            //console.log(val.length);
            if(data.length==0)
            {
                //console.log(val);
                errors.push({ msg: 'No Shop is registered for this pincode.' });
                res.render('index', {
                    errors,
                    pincode,
                    val:val,
                    pcode:pcode,
                    user:req.user
                });
            }
            else{
                res.render('index-1',{val:val,pcode:pcode,user:req.user});
            }
        })
    }
});


/***************************** Area Filter *****************************/
router.post('/filterarea',function(req,res)
{
    if(!req.body.area)
    {
        let errors=[];
        errors.push({ msg: 'Please enter a valid area' });
        Shopowner.find({pincode:req.body.pincode},function(err,data)
        {
            if(err)
            {
                process.exit(1);
            }
            //console.log(data.length);
            let set=new Set();
            for(let i=0;i<data.length;i++)
            {
                set.add(data[i].area);
            }
            let pcode={
                pc:req.body.pincode
            };
            let val=Array.from(set);
            val.sort();
            res.render('index-1',{errors,val:val,pcode:pcode,user:req.user});
        })
    }
    else
    {
        Shopowner.find({pincode:req.body.pincode,area:req.body.area},function(err,data)
        {
            if(err)
            {
                process.exit(1);
            }
            res.render('shopslist',{data:data,user:req.user});
        })
    }
    
});


/***************************** Shop Filter *****************************/
router.post('/filtershop',function(req,res)
{
    Shopowner.find({pincode:req.body.pincode,area:req.body.area,shopname:req.body.shopname},function(err,data)
    {
        if(err)
        {
            process.exit(1);
        }
        res.render('shopsearch',{data:data,user:req.user});
      })
});


/***************************** Add Customer in Queue *****************************/
router.post('/addqueuepage',urlencodedParser, ensureAuthenticated , function(req,res)
{
    let phoneNumbers = req.body.phonenumber;
    let items= req.body.listofitems;
    let errors=[];
    if (!phoneNumbers)
    {
        errors.push({ msg: 'Please enter your mobile number' });
    }
    else if(phoneNumbers.length !=10)
    {
        errors.push({ msg: 'Please enter valid mobile number' });
    }
    else
    {
        for(var i=0;i<phoneNumbers.length;i++)
        {
            if(phoneNumbers[i]<'0' || phoneNumbers[i]>'9')
            {
                errors.push({ msg: 'Please enter valid mobile number' });
                break;
            }
        }
    }
    if (errors.length > 0) {
        Shopowner.find({pincode:req.body.pincode,area:req.body.area,shopname:req.body.shopname},function(err,data)
        {
            res.render('shopsearch',{   
                data:data,
                errors,
                user:req.user});
        });
    }
    else{
        Shopowner.findOneAndUpdate({pincode:req.body.pincode,area:req.body.area,shopname:req.body.shopname},
        {
            $push: {phoneNumbers:req.body.phonenumber,items:req.body.listofitems}
        },
        function(err, docs)
        {
            if(err)
            {
                res.json(err);
            }
            else
            {
                Shopowner.find({pincode:req.body.pincode,area:req.body.area,shopname:req.body.shopname},function(err,data)
                {
                    var pos = (data[0].items.length);
                    try{
                        if(data[0].items.length == 1) {
                            const response = fast2sms.sendMessage({authorization: process.env.API_KEY, sender_id: 'SABLCL', message: `You have been added successfully to the queue at ${data[0].shopname}. Your position in the queue is ${pos}. You should reach the shop within 7 minutes else your registration will be cancelled. 
Regards
SAB LOCAL` , numbers: [req.body.phonenumber]});
                        }
                        else if(data[0].items.length == 2) {
                            const response = fast2sms.sendMessage({authorization: process.env.API_KEY, sender_id: 'SABLCL', message: `You have been added successfully to the queue at ${data[0].shopname}. Your position in the queue is ${pos}. You should reach the shop within 7-14 minutes from now else your registration will be cancelled. 
Regards
SAB LOCAL` , numbers: [req.body.phonenumber]});
                        }
                        else {
                            var exptime = (data[0].items.length - 1) * 7;
                            //console.log(exptime);
                            const response = fast2sms.sendMessage({authorization: process.env.API_KEY, sender_id: 'SABLCL', message: `You have been added successfully to the queue at ${data[0].shopname}. Your position in the queue is ${pos}. Your expected time is ${exptime} minutes from now. You will be notified once again about the exact time. 
Regards
SAB LOCAL` , numbers: [req.body.phonenumber]});
                        }
                        res.render('shopsearch',{data:data,user:req.user});
                    }
                    catch(err) {
                        console.log(err);
                        process.exit(1);
                    }
                })
            }
        });
    }
});


/***************************** Editing About of the Shop *****************************/
router.post('/editabout',urlencodedParser,function(req,res){
    let newobj={
       aboutshop:req.body.newaboutshop
    };
    Shopowner.findOneAndUpdate({pincode:req.body.pincode,area:req.body.area,shopname:req.body.shopname},
    newobj,
    function(err, docs)
    {
        if(err)
        {
            res.json(err);
        }
        else
        {
            Shopowner.find({pincode:req.body.pincode,area:req.body.area,shopname:req.body.shopname},function(err,data)
            {
                if(err)
                {
                    process.exit(1);
                }
                res.render('myshop',{data:data,user:req.user});
            })
        }
   });
});

/***************************** Reducing count of the queue *****************************/
router.post('/reducecount',urlencodedParser,function(req,res){
  console.log(req.body);
    Shopowner.findOneAndUpdate({pincode:req.body.pincode,area:req.body.area,shopname:req.body.shopname},
    {
        $pop: {phoneNumbers:-1,items:-1}
    },
    function(err, docs)
    {
        if(err)
        {
            res.json(err);
        }
        else
        {
          Shopowner.find({pincode:req.body.pincode,area:req.body.area,shopname:req.body.shopname},function(err,data)
          {
              if(err)
              {
                  process.exit(1);
              }
              if(data[0].items.length > 1) {
                const response = fast2sms.sendMessage({authorization: process.env.API_KEY, sender_id: 'SABLCL', message: `This is a reminder message. Your current position in the queue at ${data[0].shopname} is 2. You should reach the shop within 7-14 minutes from now else your registration will be cancelled.
Regards
SAB LOCAL` , numbers: [data[0].phoneNumbers[1]]}); 
              }
              res.render('myshop',{data:data,user:req.user});
          })
        }
   });
});

// ************************ Contact Us from index/index-1 *******************************
router.post('/contactindex', function(req,res){
    
    const { username, useremail, message } = req.body;
    //console.log(req.body.username);
    //console.log(req.body.useremail);
    //console.log(req.body.message);
    let errors = [];
    
    // Check required fields
    if(!username || !useremail || !message ){
        errors.push({msg: 'Please fill in all fields'});
    }
    
    if (errors.length > 0) {
        res.render('index', {
            errors,
            username,
            useremail,
            message,
            user: req.user
        });
    }
    else{
        const newContact = new Contact({
            username,
            useremail,
            message
        });
        //Save Contact
        newContact.save()
        .then(contact => {
            req.flash(
                'success_msg',
                'Your message has been sent'
            );
            res.redirect('/');
        })
        .catch(err => console.log(err));
    }
});

module.exports = router;