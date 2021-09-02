const { Client : DiscordClient, Collection, Intents, Guild, GuildMember, Permissions } = require('discord.js');

const guild_id = "876513971191046194";
const enrolled_id = "877798118094143519";
const teacher_id = "879962880559181916";

async function update_channel_perms(client, uid, channel_ids, all_channel_ids, perms, other_channel_ids=[], other_perms=undefined, dept_ids=[]) { 
	// channel_ids is an arr containing the channel IDs of the courses they should be in
	// all_channel_ids is an arr containing all of the course channel IDs (refreshed every 5s before updating perms)
	dept_perms = { VIEW_CHANNEL: true, SEND_MESSAGES : true};
	guild = await client.guilds.fetch(guild_id);
	member = await guild.members.fetch(uid);
	for (id of all_channel_ids) {
		channel = await guild.channels.fetch(id);
		if(channel_ids.includes(id)) {
			channel.permissionOverwrites.edit(member, perms); // what i think is the v12/v13 equivalent of channel.updateOverwrite()
		} else if (other_channel_ids.includes(id) && typeof other_perms !== 'undefined'){
			channel.permissionOverwrites.edit(member, other_perms);
		}
		else if (dept_ids.includes(id)) {
			channel.permissionOverwrites.edit(member, dept_perms);
		}
		else {
			try {
				channel.permissionOverwrites.delete(member);
			}
			catch(err) {
				
			}

			 
		}

	}
	
};

async function add_role(client, uid, role_id) {
	guild = await client.guilds.fetch(guild_id);
	member = await guild.members.fetch(uid);
	role = await guild.roles.fetch(role_id);
	member.roles.add(role);
};

async function check_for_role(client, uid, role_id) {
	guild = await client.guilds.fetch(guild_id);
	member = await guild.members.fetch(uid);
	return member._roles.includes(role_id);
};

async function get_user_from_id(client, uid) {
	guild = await client.guilds.fetch(guild_id);
	member = await guild.members.fetch(uid);
	return `${member.user.tag}`;
};

async function get_id_from_user(client, username) {
	guild = await client.guilds.fetch(guild_id);
	uid = await guild.members.search({query : username.substring(0, username.length-5)});

	results = [...uid.values()];

	user_id = "Not Found";

	for(res of results) {
		if(res.user.discriminator == username.substring(username.length-4, username.length)) {
			user_id = res.user.id; 
		}
	};

	return user_id;
 
};

async function send_message_to_channel(client, channel_id, msg) {
	guild = await client.guilds.fetch(guild_id);
	channel = await guild.channels.fetch(channel_id);
	channel.send(msg);
};




module.exports = {
	update_channel_perms : update_channel_perms,
	add_role : add_role,
	check_for_role : check_for_role,
	get_user_from_id : get_user_from_id,
	get_id_from_user : get_id_from_user,
	send_message_to_channel : send_message_to_channel,
	guild_id : guild_id,
	enrolled_id : enrolled_id,
	teacher_id : teacher_id,
	log_channel_id : "880335228000931891",
	all_dept_channel_ids : ["878142767342190612", "878142316555165736", "878142356170346527", "878142874485686303", "878142269771882527",
"878142826804813855", "878143102139908146", "878143010674724924", "878143066379288596", "878143135283314739"] // temporary, will actually pull from the database later
};