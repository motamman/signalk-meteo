# SignalK Meteo Plugin

A SignalK plugin that provides position-based weather forecast data using the Meteoblue API. This plugin automatically fetches weather forecasts based on the vessel's current position and publishes the data to SignalK.

## Features

- **Position-based forecasts**: Automatically updates forecasts when the vessel moves significantly
- **Multiple forecast packages**: Selectable Meteoblue packages (Basic, Wind, Sea, Solar, Agro, Trend, Clouds)
- **Hourly forecasts**: Up to 7 days (168 hours) of hourly weather data
- **Daily forecasts**: Up to 14 days of daily weather summaries
- **Comprehensive data**: Temperature, wind, precipitation, pressure, humidity, visibility, UV index, and more
- **Unit conversions**: Automatically converts to SignalK standard units (Kelvin, Pascals, meters/second, etc.)
- **Account monitoring**: API key validation and usage tracking with automatic notifications
- **Usage alerts**: SignalK notifications when approaching API limits (80% warning, 90% critical)
- **Flexible configuration**: Configurable update intervals and forecast ranges

## Requirements

- SignalK Server v2.13.0 or later
- Meteoblue API key (free tier available)
- Vessel position data (navigation.position)

## Installation

1. Install via SignalK App Store, or
2. Clone this repository to your SignalK plugins directory
3. Run `npm install` in the plugin directory
4. Restart SignalK Server

## Configuration

The plugin requires the following configuration:

### Required Settings
- **Meteoblue API Key**: Your API key from Meteoblue (get one at https://www.meteoblue.com/en/weather-api)

### Optional Settings
- **Forecast Update Interval**: How often to fetch new forecasts in minutes (default: 120, minimum: 30)
- **Vessel Altitude**: Altitude above sea level in meters for forecast calculations (default: 15)
- **Enable Position Subscription**: Automatically update forecasts when position changes significantly (default: true)
- **Maximum Hourly Forecast Hours**: Number of hourly forecast periods (default: 72, max: 168)
- **Maximum Daily Forecast Days**: Number of daily forecast periods (default: 10, max: 14)

### Meteoblue Package Selection
The plugin supports multiple Meteoblue forecast packages. **Basic**, **Wind**, and **Sea** packages are enabled by default:

- **Basic 1h/Day**: Core weather data (temperature, precipitation, wind, pressure, humidity) - **Default: ON**
- **Wind 1h/Day**: Detailed wind data (gusts, direction variations) - **Default: 1h ON, Day OFF**
- **Sea 1h/Day**: Marine conditions (wave height, sea temperature) - **Default: 1h ON, Day OFF**
- **Solar 1h/Day**: Solar radiation and UV data - **Default: OFF**
- **Agro 1h/Day**: Agricultural weather data - **Default: OFF**
- **Trend 1h**: Weather trend analysis - **Default: OFF**
- **Clouds 1h/Day**: Detailed cloud cover data - **Default: OFF**

## Data Structure

The plugin publishes weather data to the following SignalK paths:

### System Information
- `environment.outside.meteo.system.metadata`: Forecast metadata including location and model run information
- `environment.outside.meteo.system.account`: Account information and API usage statistics

### Notifications
- `notifications.meteo.apiUsage`: API usage warnings and alerts (SignalK notification format)

### Hourly Forecasts
- `environment.outside.meteo.forecast.hourly.{N}`: Individual hourly forecasts (N = 0 to maxHours-1)
- `environment.outside.meteo.forecast.{parameter}.hour`: Structured data by parameter with relative hour keys

### Daily Forecasts
- `environment.outside.meteo.forecast.daily.{N}`: Individual daily forecasts (N = 0 to maxDays-1)

### Available Parameters

#### Hourly Forecast Data
- `timestamp`: ISO 8601 timestamp
- `relativeHour`: Hours relative to current time (e.g., +6 for 6 hours from now)
- `temperature`: Air temperature (Kelvin)
- `windSpeed`: Wind speed (m/s)
- `windDirection`: Wind direction (radians)
- `precipitation`: Precipitation amount (meters)
- `weatherCode`: Meteoblue weather code
- `pressure`: Sea level pressure (Pascals)
- `relativeHumidity`: Relative humidity (ratio 0-1)
- `visibility`: Visibility (meters)
- `cloudCover`: Cloud cover (ratio 0-1)
- `uvIndex`: UV index
- `feltTemperature`: Apparent/feels-like temperature (Kelvin)
- `precipitationProbability`: Probability of precipitation (ratio 0-1)

#### Daily Forecast Data
- `date`: Date string
- `dayOfWeek`: Day of the week name
- `temperatureMax/Min`: Maximum/minimum temperatures (Kelvin)
- `windSpeedMax`: Maximum wind speed (m/s)
- `windDirection`: Dominant wind direction (radians)
- `precipitation`: Total precipitation (meters)
- `weatherCode`: Meteoblue weather code
- `pressureMean`: Mean pressure (Pascals)
- `relativeHumidityMean`: Mean humidity (ratio 0-1)
- `visibilityMean`: Mean visibility (meters)
- `cloudCoverMean`: Mean cloud cover (ratio 0-1)
- `uvIndexMax`: Maximum UV index
- `precipitationProbability`: Probability of precipitation (ratio 0-1)
- `sunshineDuration`: Sunshine duration (seconds)
- `feltTemperatureMax/Min`: Maximum/minimum apparent temperatures (Kelvin)

## Position-based Updates

The plugin automatically monitors the vessel's position and updates forecasts when:
1. The configured update interval has elapsed, OR
2. The vessel has moved more than approximately 5 nautical miles from the last forecast location

This ensures you always have relevant local weather data without excessive API calls.

## API Usage

The plugin uses the Meteoblue API with configurable packages:
- **Basic packages**: `basic-1h`, `basic-day` - Core weather parameters
- **Wind packages**: `wind-1h`, `wind-day` - Enhanced wind data
- **Sea packages**: `sea-1h`, `sea-day` - Marine conditions
- **Solar packages**: `solar-1h`, `solar-day` - Solar radiation data
- **Agricultural packages**: `agro-1h`, `agro-day` - Agricultural weather data
- **Trend packages**: `trend-1h` - Weather trend analysis
- **Cloud packages**: `clouds-1h`, `clouds-day` - Detailed cloud data

API calls are made at the configured interval or when position changes significantly. Each enabled package consumes API quota, so select only the packages you need. The free tier typically allows for reasonable usage for most vessels.

## Source Identification

Data from different packages is published with specific source labels:
- `meteo-basic-api` - Basic weather data
- `meteo-wind-api` - Wind data
- `meteo-sea-api` - Marine data
- `meteo-solar-api` - Solar data
- `meteo-agro-api` - Agricultural data
- `meteo-trend-api` - Trend data
- `meteo-clouds-api` - Cloud data
- `meteo-metadata-api` - Forecast metadata
- `meteo-account-api` - Account information and usage statistics

## Troubleshooting

### Common Issues
1. **No forecasts appearing**: Check that you have a valid Meteoblue API key and the vessel has position data
2. **Forecasts not updating**: Verify the position subscription is working and the update interval isn't too long  
3. **API errors**: Check your API key validity and usage limits
4. **"Could not validate API key" warning**: Check your Meteoblue API key and internet connectivity
5. **Usage notifications**: Monitor your API usage in `environment.outside.meteo.system.account` - notifications will appear at 80% and 90% usage

### Debug Information
Enable debug logging in SignalK to see detailed plugin operation including:
- Position updates and forecast triggers
- API requests and responses
- Data processing steps

## Development

Built with TypeScript and follows SignalK plugin standards.

### Building
```bash
npm run build
```

### Linting
```bash
npm run lint
npm run lint:fix
```

### Formatting
```bash
npm run format
npm run format:check
```

## License

MIT License - see LICENSE file for details.

## Credits

Based on the Node-RED weather ingest flows and inspired by the SignalK WeatherFlow plugin architecture. Weather data provided by Meteoblue.