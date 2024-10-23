require("dotenv").config();
const User=require("./UserDataBase");
const jwt=require("jsonwebtoken");

const jsonwebtoken=(req,res,next) =>{
    const token = req.cookies.token; // Read the token from cookies
    
    if (!token) {
        return res.status(401).send('Token is missing');
    }

    try {
        const data=jwt.verify(token,process.env.JWT_SIGN);
        req.payload=data;
        next();
    } catch (error) {
        console.log(err);
        return res.status(403);
    }
};

const generateJWT=(userData)=>{
    return jwt.sign(userData,process.env.JWT_SIGN, {expiresIn:"1d"});
}

module.exports={jsonwebtoken,generateJWT};