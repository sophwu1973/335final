const path = require("path");
const express = require("express");
const { table } = require("console");
const bodyParser = require("body-parser");
const { request } = require("https");
const app = express();
app.use(bodyParser.urlencoded({extended:false}));
app.set("views", path.resolve(__dirname, "templates"));
require("dotenv").config({ path: path.resolve(__dirname, '.env') }) 
app.set("view engine", "ejs");
app.use(express.static(__dirname + '/public'));
const uri = process.env.MONGO_CONNECTION_STRING;
const { MongoClient, ServerApiVersion } = require('mongodb');
const { render } = require("ejs");
process.stdin.setEncoding("utf8");
const databaseAndCollection = {db: process.env.MONGO_DB_NAME, collection:process.env.MONGO_COLLECTION};
const client = new MongoClient(uri, {serverApi: ServerApiVersion.v1 });
const db = client.db(databaseAndCollection.db).collection(databaseAndCollection.collection);

if (process.argv.length !== 3) {
    console.log("Usage: node ipLocator.js <portnumber>");
    process.exit(1);
  }
  
  const portNumber = process.argv[2];
  console.log(`Server running at http://localhost:${portNumber}\n`);
  console.log('Type "stop" to shutdown the server:');

  process.stdin.setEncoding("utf8");
  process.stdin.on("readable", () => {
    const input = process.stdin.read();
    if (input !== null) {
      const command = input.trim();
      if (command === "stop") {
        process.stdout.write("Shutting down the server\n");
        process.exit(0);
      } else {
        process.stdout.write("Invalid command: " +input)
        process.stdout.write('Type "stop" to shutdown the server:');
      }
    process.stdout.write(prompt);
    process.stdin.resume();
    }
  });

async function getLocations(client){
    try {
        await client.connect();
        let result = await db.find({}).toArray()
        return result
    } catch (e) {
        console.error(e)
    } finally {
        await client.close()
    }
}

async function add(client,info){
    try {
        await client.connect();
        const result = await db.insertOne(info)
        return result
    } catch (e){
        console.error(e)
    } finally {
        await client.close()
    }
}

async function removeAll(client){
    try {
        await client.connect();
        let result = await db.deleteMany({})
        return result
    } catch(e) {
        console.error(e)
    } finally {
        await client.close()
    }
}

async function getData(ip){
    let response = await fetch(`http://ip-api.com/json/${ip}`)
    let json = await response.json()
    return json
}


function mapping(lat, lon){
    let result = `<a href="https://www.google.com/maps/search/?api=1&query=${lat},${lon}">MAP</a>` 
    return result
}

app.get("/", (request, response) => { 
    response.render("index")
});

app.get("/findIP", (request, response) => { 
    response.render("findIP")
});

app.get("/listLocations", async (req, res) => {
    try {
        const locations = await getLocations(client);
        if (locations.length === 0) {
            res.render("noData");
        } else {
            const rows = locations.map(location => {
                return `<tr>
                            <td>${location.name}</td>
                            <td>${location.ip}</td>
                            <td>${location.country}</td>
                        </tr>`;
            }).join('');
            res.render("list", { data: rows });
        }
    } catch (err) {
        console.error("Error fetching locations:", err);
        res.render("error", { message: "Failed to fetch locations." });
    }
});

app.get("/openMap", (request, response) => { 
    response.render("getMap")
});

app.get("/cleared",async (request, response)=>{
    await removeAll(client)
    response.render("cleared")
});


app.post("/showData", async (req, res) => {
    try {
        const ip = req.body.ip;
        const ipData = await getData(ip);
        
        if (ipData.status === "fail") {
            res.render("failure", { message: ipData.message });
        } else {
            const locationInfo = {
                name: req.body.name,
                ip: ip,
                country: ipData.countryCode,
                map: mapping(ipData.lat, ipData.lon)
            };

            const entry = {
                name: req.body.name,
                ip: ip,
                country: ipData.countryCode,
            };

            await add(client, entry);
            res.render("found", locationInfo);
        }
    } catch (err) {
        console.error("Error fetching IP data:", err);
        res.render("failure", { message: "Error processing the IP data." });
    }
});

app.listen(portNumber);

