const { Client, Collection, Intents, Guild, GuildMember, Permissions } = require('discord.js');
const winston = require('winston'); // logging!
const fs = require('fs');
require('dotenv').config();


const client = new Client({ intents: [Intents.FLAGS.GUILDS] });
client.login(process.env.token);