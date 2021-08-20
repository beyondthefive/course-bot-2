const guild_id = "876513971191046194";
const enrolled_id = "877798118094143519";

async function update_channel_perms(client, uid, channel_ids, perms) {
	for(id of channel_ids) {
		guild = await client.guilds.fetch(guild_id);
		channel = await guild.channels.fetch(id);
		member = await guild.members.fetch(uid);
		channel.permissionOverwrites.edit(member, perms); // what i think is the v12/v13 equivalent of channel.updateOverwrite()
	};
	
};

async function add_role(client, uid, role_id) {
	guild = await client.guilds.fetch(guild_id);
	member = await guild.members.fetch(uid);
	role = await guild.roles.fetch(role_id)
	member.roles.add(role);
};

async function check_for_role(client, uid, role_id) {
	guild = await client.guilds.fetch(guild_id);
	member = await guild.members.fetch(uid);
	return member._roles.includes(role_id);
};

module.exports = {
	update_channel_perms : update_channel_perms,
	add_role : add_role,
	check_for_role : check_for_role,
	guild_id : guild_id,
	enrolled_id : enrolled_id 
};