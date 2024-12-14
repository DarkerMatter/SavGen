# Use an official Node.js image as the base
FROM node:18-alpine

# Set working directory
WORKDIR /usr/src/app

# Copy package.json and package-lock.json (if available)
COPY package*.json ./

# Install dependencies
RUN npm install --omit=dev

# Copy the rest of your bot's source code to the container
COPY . .

# Make the database directory (if you want to persist SQLite locally within the container)
RUN mkdir -p /usr/src/app/data
WORKDIR /usr/src/app

# By default, SQLite will create the database in the current working directory
ENV DATABASE_FILE=/usr/src/app/data/keys.db

# Start the bot application
CMD ["node", "bot.js"]