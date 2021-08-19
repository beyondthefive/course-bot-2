const guild_id = "876513971191046194";

async function update_channel_perms(client, uid, channel_ids, perms) {
	for(id of channel_ids) {
		channel = client.channels.cache.get(id);
		channel.permissionOverwrites.edit(uid, perms);
	};
	
};

async function add_role(client, uid, role) {
	guild = client.guilds.cache.get(guild_id);
	member = guild.members.cache.get(uid);
	member.add(guild.roles.cache.find(role => role.name == "new role"));
};

module.exports = {
	update_channel_perms : update_channel_perms,
	add_role : add_role,
	guild_id : guild_id

};