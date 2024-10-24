require("dotenv").config();
const mongoose=require("mongoose");
mongoose.connect(process.env.URL);

const CommSchema=mongoose.Schema({
    name:String,
    pass:String,
    posts:[
        {
            id:String,
            post:String
        }
    ]
});

const Community=mongoose.model("Community",CommSchema);
module.exports=Community;