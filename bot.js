const { Client, GatewayIntentBits, SlashCommandBuilder, REST, Routes, EmbedBuilder } = require('discord.js');
const sqlite3 = require('sqlite3').verbose();
const { TOKEN, GUILD_ID } = require('dotenv').config().parsed;

// Role ID for permission check
const ROLE_ID = '1317319154105061438';

// Create the bot client
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.DirectMessages, GatewayIntentBits.GuildMessages] });

// Set up the local SQLite database
const db = new sqlite3.Database('./keys.db', (err) => {
    if (err) console.error(err.message);
    console.log('Connected to the SQLite database for product keys.');
});

// Initialize the database if it doesn't exist
db.run(`
    CREATE TABLE IF NOT EXISTS product_keys (
        key_id INTEGER PRIMARY KEY AUTOINCREMENT,
        product TEXT,
        duration TEXT,
        product_key TEXT UNIQUE,
        assigned_to TEXT
    )
`);

// Register slash commands
client.once('ready', async () => {
    console.log(`Logged in as ${client.user.tag}!`);

    const commands = [
        new SlashCommandBuilder()
            .setName('add')
            .setDescription('Add a product key or multiple keys to the database (unassigned)')
            .addStringOption(option =>
                option.setName('product')
                    .setDescription('The product this key is for')
                    .setRequired(true)
                    .addChoices(
                        { name: 'Bo6 Rage', value: 'Bo6 Rage' },
                        { name: 'Bo6 External', value: 'Bo6 External' },
                        { name: 'Bo6 External V2', value: 'Bo6 External V2' },
                        { name: 'Bo6 UA', value: 'Bo6 UA' },
                        { name: 'Mw3 Rage', value: 'Mw3 Rage' },
                        { name: 'Mw3 AIO', value: 'Mw3 AIO' },
                        { name: 'Mw3 UA', value: 'Mw3 UA' },
                        { name: 'Mw3 External', value: 'Mw3 External' },
                    )
            )
            .addStringOption(option =>
                option.setName('duration')
                    .setDescription('The duration of the key')
                    .setRequired(true)
                    .addChoices(
                        { name: 'Day', value: 'Day' },
                        { name: 'Week', value: 'Week' },
                        { name: 'Month', value: 'Month' },
                        { name: 'Lifetime', value: 'Lifetime' },
                    )
            )
            .addStringOption(option =>
                option.setName('product_key')
                    .setDescription('The product key or keys (comma-separated) to add')
                    .setRequired(true)
            ),
        new SlashCommandBuilder()
            .setName('issue')
            .setDescription('Issue an unassigned product key to a user')
            .addStringOption(option =>
                option.setName('product')
                    .setDescription('The product to issue the key for')
                    .setRequired(true)
                    .addChoices(
                        { name: 'Bo6 Rage', value: 'Bo6 Rage' },
                        { name: 'Bo6 External', value: 'Bo6 External' },
                        { name: 'Bo6 External V2', value: 'Bo6 External V2' },
                        { name: 'Bo6 UA', value: 'Bo6 UA' },
                        { name: 'Mw3 Rage', value: 'Mw3 Rage' },
                        { name: 'Mw3 AIO', value: 'Mw3 AIO' },
                        { name: 'Mw3 UA', value: 'Mw3 UA' },
                        { name: 'Mw3 External', value: 'Mw3 External' },
                    )
            )
            .addStringOption(option =>
                option.setName('duration')
                    .setDescription('The duration of the key')
                    .setRequired(true)
                    .addChoices(
                        { name: 'Day', value: 'Day' },
                        { name: 'Week', value: 'Week' },
                        { name: 'Month', value: 'Month' },
                        { name: 'Lifetime', value: 'Lifetime' },
                    )
            )
            .addUserOption(option =>
                option.setName('user')
                    .setDescription('The user to issue the product key to')
                    .setRequired(true)
            ),
        new SlashCommandBuilder()
            .setName('inventory')
            .setDescription('Show the amount of unassigned keys in the database')
    ].map(command => command.toJSON());

    const rest = new REST({ version: '10' }).setToken(TOKEN);

    try {
        console.log('Started refreshing application (/) commands.');
        await rest.put(
            Routes.applicationGuildCommands(client.user.id, GUILD_ID),
            { body: commands }
        );
        console.log('Successfully reloaded application (/) commands.');
    } catch (error) {
        console.error(error);
    }
});

// Check if the user has the required role
function hasRequiredRole(member) {
    return member.roles.cache.has(ROLE_ID);
}

// Handle slash commands
client.on('interactionCreate', async interaction => {
    if (!interaction.isCommand()) return;

    const { commandName, options, member } = interaction;

    if (commandName === 'add') {
        // Check for role permissions
        if (!hasRequiredRole(member)) {
            return interaction.reply({ content: 'You do not have permission to use this command.', ephemeral: true });
        }

        const product = options.getString('product');
        const duration = options.getString('duration');
        const productKeys = options.getString('product_key');

        // Handle comma-separated keys
        const keys = productKeys.split(',').map(key => key.trim()); // Trim whitespace from each key

        // Prepare to track successes and potential errors
        let successCount = 0;
        let duplicateCount = 0;
        let failedKeys = [];

        // Insert each key into the database
        for (const key of keys) {
            await new Promise(resolve => {
                db.run(`
                    INSERT INTO product_keys (product, duration, product_key, assigned_to)
                    VALUES (?, ?, ?, NULL)
                `, [product, duration, key], (err) => {
                    if (err) {
                        if (err.message.includes('UNIQUE constraint')) {
                            duplicateCount++;
                        } else {
                            failedKeys.push(key);
                        }
                    } else {
                        successCount++;
                    }
                    resolve();
                });
            });
        }

        // Generate a response
        let response = `Successfully added **${successCount}** keys for **${product}** with duration **${duration}**.`;
        if (duplicateCount > 0) response += `\n- **${duplicateCount}** keys were duplicates and not added.`;
        if (failedKeys.length > 0) response += `\n- Failed to add the following keys: \`${failedKeys.join(', ')}\`.`;

        interaction.reply({ content: response, ephemeral: true });
    } else if (commandName === 'issue') {
        // Check for role permissions
        if (!hasRequiredRole(member)) {
            return interaction.reply({ content: 'You do not have permission to use this command.', ephemeral: true });
        }

        const product = options.getString('product');
        const duration = options.getString('duration');
        const user = options.getUser('user');

        db.get(`
            SELECT * FROM product_keys
            WHERE product = ? AND duration = ? AND assigned_to IS NULL
            LIMIT 1
        `, [product, duration], (err, row) => {
            if (err) {
                console.error(err.message);
                return interaction.reply({ content: 'Failed to retrieve an unassigned product key.', ephemeral: true });
            }

            if (!row) {
                return interaction.reply({ content: `No unassigned keys found for **${product}** with duration **${duration}**. Please add more keys using /add.`, ephemeral: true });
            }

            db.run(`
                UPDATE product_keys
                SET assigned_to = ?
                WHERE key_id = ?
            `, [user.id, row.key_id], (updateErr) => {
                if (updateErr) {
                    console.error(updateErr.message);
                    return interaction.reply({ content: 'Failed to assign the product key to the user.', ephemeral: true });
                }

                const embed = new EmbedBuilder()
                    .setTitle('Product Key Issued')
                    .setColor('#ffffff')
                    .setDescription(`You have been issued a product key!\n\n**Product:** ${row.product}\n**Duration:** ${row.duration}\n**Key:** \`${row.product_key}\``)
                    .setTimestamp();

                user.send({ embeds: [embed] }).then(() => {
                    interaction.reply({ content: `Successfully issued the product key to ${user.tag}.`, ephemeral: true });
                }).catch(dmErr => {
                    console.error(dmErr);
                    interaction.reply({ content: `Failed to DM the user ${user.tag}. Please ensure they have DMs enabled.`, ephemeral: true });
                });
            });
        });
    } else if (commandName === 'inventory') {
        // Check for role permissions
        if (!hasRequiredRole(member)) {
            return interaction.reply({ content: 'You do not have permission to use this command.', ephemeral: true });
        }

        db.all(`
            SELECT product, duration, COUNT(*) AS total
            FROM product_keys
            WHERE assigned_to IS NULL
            GROUP BY product, duration
        `, (err, rows) => {
            if (err) {
                console.error(err.message);
                return interaction.reply({ content: 'Failed to fetch the inventory.', ephemeral: true });
            }

            if (rows.length === 0) {
                return interaction.reply({ content: 'No unassigned keys found in the inventory.', ephemeral: true });
            }

            const embed = new EmbedBuilder()
                .setTitle('Unassigned Product Keys Inventory')
                .setColor('#00ff00')
                .setTimestamp();

            rows.forEach(row => {
                embed.addFields({ name: `${row.product} (${row.duration})`, value: `${row.total} keys`, inline: false });
            });

            return interaction.reply({ embeds: [embed], ephemeral: true });
        });
    }
});

// Login the bot
client.login(TOKEN);