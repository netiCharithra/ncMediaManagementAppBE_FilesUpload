const { S3Client, PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");

const dotenv = require('dotenv');
dotenv.config()

const express = require('express')
require('express-async-errors')
const app = express();
const cors = require("cors")
const multer = require('multer');
const { google } = require('googleapis');


const BUCKET_NAME = process.env.BUCKET_NAME
const BUCKET_REGION = process.env.BUCKET_REGION
const POLICY_NAME = process.env.POLICY_NAME

const ACCESS_KEY = process.env.ACCESS_KEY
const SECRET_ACCESS_KEY = process.env.SECRET_ACCESS_KEY


const s3 = new S3Client({
    credentials: {
        accessKeyId: ACCESS_KEY,
        secretAccessKey: SECRET_ACCESS_KEY
    },
    region: BUCKET_REGION
})

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const allowedOrigins = ['http://localhost:4201', 'https://neticharithra-ncmedia.web.app']; // Add more origins if needed
app.use(cors({
    origin: function (origin, callback) {
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    }
}));

const fs = require('fs');
const reporterSchema = require('./modals/reportersSchema');
const errorLogBookSchema = require('./modals/errorLogBookSchema');
const connect = require('./connectDB/mongoDB');
require('dotenv').config();
const bodyParser = require('body-parser');
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));


const start = async () => {
    let port = process.env.PORT || 3001
    try {
        await connect(process.env.MONGO_DB_URL)
        app.listen(port, () => {
            console.log(`listening port ${port}`)
        })
    } catch (error) {
        console.error(error)
    }
}

const storage = multer.memoryStorage()

const upload = multer({ storage: storage })
const stream = require('stream');

app.post('/api/upload/uploadFiles', upload.array('images'), async (req, res) => {

    try {

        let uploadedImages = []

        // const file = req.file


        console.log(req)

        if (req?.files?.length > 0) {
            for (let index = 0; index < req.files.length; index++) {
                const fileName = "FileNew" + new Date().getTime()+'_0';
                const uploadParams = {
                    Bucket: BUCKET_NAME,
                    Body: req.files[index].buffer,
                    Key: fileName,
                    ContentType: req.files[index].mimetype
                }

                // Send the upload to S3
                await s3.send(new PutObjectCommand(uploadParams));
                const fileURLTemp = await getFileTempUrls3(fileName)
                uploadedImages.push({
                    fileName  : fileName,
                    tempURL : fileURLTemp,
                    ContentType: req.files[index].mimetype
                })

            }
        }
        console.log(uploadedImages)
        // Configure the upload details to send to S3



        // console.log(url)


        res.status(200).json({
            status: "SS",
            msg: 'ss to while processing..',
            data: uploadedImages

        });
    } catch (error) {
        // const obj = await errorLogBookSchema.create({
        //     message: `Error while uploading files to drive`,
        //     stackTrace: JSON.stringify([...error.stack].join('\n')),
        //     page: (req.body && req.body.uploadType) ? req.body.uploadType + " uploading" : 'Uploading News Image',
        //     functionality: (req.body && req.body.uploadType) ? req.body.uploadType + " uploading" : 'Uploading News Image',
        //     errorMessage: `${JSON.stringify(error) || ''}`
        // })

        console.error(error)
        res.status(200).json({
            status: "failed",
            msg: 'Failed to while processing..',

        });
    }

});

async function getFileTempUrls3(fileName) {
    // GETTING IMAGE URL
    const url = await getSignedUrl(
        s3,
        new GetObjectCommand({
            Bucket: BUCKET_NAME,

            Key: fileName
            // ContentType: file.mimetype
        }),
        { expiresIn: 3600 }// 60 seconds
    );
    return url
}


async function uploadToDrive(file, folderId) {

    const params = {
        Bucket: BUCKET_NAME,
        Key: "FILE_" + new Date().getTime() + "_0",
        Body: file,
        // contentType:'jp'
    }
    const command = new PutObjectCommand(params)

    s3.send(command)
    console.log("HII")
    // const credentials = require('./cred.json'); // Replace with your Google Drive API credentials

    // const auth = new google.auth.JWT(
    //     credentials.client_email,
    //     null,
    //     credentials.private_key,
    //     ['https://www.googleapis.com/auth/drive']
    // );

    // const drive = google.drive({ version: 'v3', auth });

    // const response = await drive.files.create({
    //     requestBody: {
    //         name: file.originalname,
    //         mimeType: file.mimetype,
    //         parents: [folderId], // Specify the folder ID where you want to upload the file
    //     },
    //     media: {
    //         mimeType: file.mimetype,
    //         body: fs.createReadStream(file.path),
    //     },
    // });

    // fs.unlinkSync(file.path); // Remove the temporary file
    //https://drive.google.com/uc?export=view&id=
    return response?.data || { key: "SUCCESS" }
}

app.post('/api/upload/registerEmployee_v2', upload.fields([{ name: 'profilePic' }, { name: 'identityProof' }]), async (req, res) => {
    try {
        console.log(req.body.name)
        let data = JSON.parse(JSON.stringify(req.body));
        console.log(data)
        let checkMail = await reporterSchema.findOne({
            mail: data.mail
        });
        console.log("ERROR FROM HERE 1")
        if (!checkMail) {
            let users = await reporterSchema.find({
                'state': data['state']
            })
            data['employeeId'] = 'NC-' + data['state'] + '-' + (users.length ? users.length + 1 : 1);
            console.log("ERROR FROM HERE 2")
            data['createdOn'] = new Date().getTime();
            const folderId = '1HBhN9kB13IeVsYBWeH5-xaz7Sdbh_pJ0'; // Replace with the ID of your target folder

            const profilePic = await uploadToDrive(req.files.profilePic[0], folderId)
                .then((response) => {
                    // console.log(response)
                    return response;
                })
                .catch(err => {
                    return res.status(200).json({
                        status: "failed",
                        msg: 'Failed to upload..! Try again later...!'
                    });
                });

            const identityProof = await uploadToDrive(req.files.identityProof[0], folderId)
                .then((response) => {
                    // console.log(response)
                    return response;
                })
                .catch(err => {
                    return res.status(200).json({
                        status: "failed",
                        msg: 'Failed to upload..! Try again later...!'
                    });
                });
            data['profilePicture'] = profilePic['id']
            data['identityProof'] = identityProof['id']
            // console.log(profilePic)
            // console.log(identityProof)

            const task = await reporterSchema.create({
                ...data
            }) //pushing data to DB           
            const token = task.createJwt();
            console.log(task)
            res.cookie("tokens", token, {
                httpOnly: true,
            }).status(200).json({
                status: "success",
                msg: "Registered successfully..! You will get a confirmation as soon as accepeted.."
            })
            // .send(task).save(task);
        } else {
            res.status(200).json({
                status: "failed",
                msg: 'Mail already registered. Try contacting your higher authority.'
            })
        }

    } catch (error) {
        const obj = await errorLogBookSchema.create({
            message: `Error while Registring Employee`,
            stackTrace: JSON.stringify([...error.stack].join('\n')),
            page: 'User self Register Page',
            functionality: 'To Register a employee',
            errorMessage: `${JSON.stringify(error) || ''}`
        })
        res.status(200).json({
            status: "failed",
            msg: 'Failed to while processing..',

        });
    }

});
start();
