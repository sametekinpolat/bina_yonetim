FROM node:20-alpine
WORKDIR /app

# Install all dependencies (including devDependencies like drizzle-kit and tsx)
COPY package.json package-lock.json ./
RUN npm ci

# Copy the rest of the source code
COPY . .

# Build the Next.js app
ENV NEXT_TELEMETRY_DISABLED=1
RUN AUTH_SECRET="dummy" DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy" npm run build

# Expose port and start
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["npm", "start"]
