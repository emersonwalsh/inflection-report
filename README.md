# Google Trends Tracker

A web application for tracking year-over-year Google Trends data for public companies across sectors.

## Development

To start a local development server:

```bash
npm start
```

Open your browser and navigate to `http://localhost:4200/`. The application will automatically reload whenever you modify any of the source files.

## Deployment

### Deploy to Hostinger (kinesiccap.com/report)

1. **Build and create the zip file:**

   ```bash
   npm run deploy:hostinger
   ```

   This creates `report.zip` in the project root.

2. **Upload to Hostinger:**

   - Log in to your Hostinger control panel
   - Go to **File Manager** (or use FTP)
   - Navigate to your `public_html` folder
   - Open or create the `report` folder
   - Upload `report.zip` to this folder
   - Extract the zip file contents
   - Delete the zip file after extraction

3. **Verify:** Visit https://kinesiccap.com/report

### Deploy to GitHub Pages

1. **Commit your changes:**

   ```bash
   git add .
   git commit -m "your commit message"
   ```

2. **Push to main:**

   ```bash
   git push origin main
   ```

3. **Deploy to GitHub Pages:**

   ```bash
   npm run deploy
   ```

   This builds the app and pushes to the `gh-pages` branch automatically.

4. **Verify:** Visit https://emersonwalsh.github.io/inflection-report/

## Available Scripts

| Command | Description |
|---------|-------------|
| `npm start` | Start development server |
| `npm run build` | Production build |
| `npm run deploy` | Deploy to GitHub Pages |
| `npm run deploy:hostinger` | Build and zip for Hostinger |
| `npm run build:data` | Rebuild data from scripts |

## Tech Stack

- Angular 21
- Tailwind CSS
- Chart.js
