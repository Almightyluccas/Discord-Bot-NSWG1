import { Client, Collection, Events, REST, Routes } from 'discord.js';
import { config } from "../config/config";
import { Command } from '../interfaces/Command';
import { messageCommand } from '../commands/message';
import { attendanceCommand } from '../commands/attendance';

const commands = [messageCommand, attendanceCommand];

interface BotClient extends Client {
    commands: Collection<string, Command>;
}

export async function commandBot(client: Client): Promise<void> {
    const botClient = client as BotClient;
    botClient.commands = new Collection<string, Command>();

    for (const command of commands) {
        botClient.commands.set(command.data.name, command);
    }

    client.once(Events.ClientReady, async () => {
        console.log(`Command Bot has logged in as ${client.user?.tag}`);

        try {
            const rest = new REST().setToken(config.DISCORD_TOKEN);
            console.log('Started refreshing application (/) commands.');
            const commandData = commands.map(command => command.data.toJSON());
            
            for (const guild of client.guilds.cache.values()) {
                try {
                    console.log(`Refreshing commands for guild: ${guild.name}`);
                    await rest.put(
                        Routes.applicationGuildCommands(client.user?.id || '', guild.id),
                        { body: commandData }
                    );
                    console.log(`Successfully refreshed commands for ${guild.name}`);
                } catch (error) {
                    console.error(`Failed to refresh commands for guild ${guild.name}:`, error);
                }
            }

            console.log('Finished refreshing all guild commands.');
        } catch (error) {
            console.error('Error managing slash commands:', error);
        }
    });

    client.on(Events.InteractionCreate, async interaction => {
        if (!interaction.isChatInputCommand()) return;

        console.log(`Received command: ${interaction.commandName} in guild: ${interaction.guild?.name}`);

        const command = botClient.commands.get(interaction.commandName);
        if (!command) {
            console.log(`Command not found: ${interaction.commandName}`);
            return;
        }

        try {
            await command.execute(interaction);
        } catch (error) {
            console.error(`Error executing command ${interaction.commandName}:`, error);
            const errorMessage = 'There was an error executing this command!';

            if (interaction.replied || interaction.deferred) {
                await interaction.followUp({ content: errorMessage, ephemeral: true });
            } else {
                await interaction.reply({ content: errorMessage, ephemeral: true });
            }
        }
    });

    client.on('guildCreate', async guild => {
        try {
            console.log(`Registering commands for new guild: ${guild.name}`);
            const rest = new REST().setToken(config.DISCORD_TOKEN);
            const commandData = commands.map(command => command.data.toJSON());
            
            await rest.put(
                Routes.applicationGuildCommands(client.user?.id || '', guild.id),
                { body: commandData },
            );
            console.log(`Successfully registered commands for new guild ${guild.name}`);
        } catch (error) {
            console.error(`Failed to register commands for new guild ${guild.name}:`, error);
        }
    });
}