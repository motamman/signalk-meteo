# SignalK Meteo Ingester 

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
- `environment.outside.meteo.forecast.hourly.{parameter}.{N}`: Individual parameters for each hour (N = 0 to maxHours-1)

### Daily Forecasts
- `environment.outside.meteo.forecast.daily.{parameter}.{N}`: Individual parameters for each day (N = 0 to maxDays-1)

### Available Parameters by Package

**Note**: Each package provides different parameters. The specific fields available depend on which Meteoblue packages are enabled.

#### Common Parameters (all forecasts include):
- `timestamp`: ISO 8601 timestamp  
- `relativeHour`: Hours relative to current time (hourly only)
- `date`: Date string (daily only)
- `dayOfWeek`: Day of the week name (daily only)

#### Basic Package Parameters:
- `temperature`, `felttemperature`: Temperature data (Kelvin)
- `windspeed`, `winddirection`: Basic wind data (m/s, radians)
- `precipitation`, `precipitation_probability`: Precipitation data (meters, ratio 0-1)
- `pictocode`: Meteoblue weather codes
- `relativehumidity`: Humidity (ratio 0-1)
- `sealevelpressure`, `surfaceairpressure`: Pressure data (Pascals)
- `uvindex`: UV index values

#### Sea Package Parameters:
- `seasurfacetemperature`: Sea surface temperature (Kelvin)
- `significantwaveheight`, `surfwave_height`, `windwave_height`: Wave heights (meters)
- `swell_significantheight`: Swell wave height (meters)
- `mean_waveperiod`, `windwave_meanperiod`, `swell_meanperiod`: Wave periods (seconds)
- `mean_wavedirection`, `windwave_direction`, `swell_meandirection`: Wave directions (radians)
- `douglas_seastate`: Douglas sea state scale
- `currentvelocity_u`, `currentvelocity_v`: Ocean current components (m/s)
- `salinity`: Water salinity

#### Wind Package Parameters:
- `windspeed`, `winddirection`: Wind data (m/s, radians)  
- `gust`: Wind gusts (m/s)
- `windspeed_80m`, `winddirection_80m`: High-altitude wind data (m/s, radians)
- `airdensity`: Air density (kg/m³)
- `surfaceairpressure`, `sealevelpressure`: Pressure data (Pascals)

#### Solar Package Parameters:
- `uvindex`: UV index
- `sunshine_duration`: Daily sunshine duration (seconds)

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

## Source Identification and Package-Specific Data

Each Meteoblue package publishes only the data fields relevant to that package type. This ensures that wave data only appears in sea sources, wind gusts only in wind sources, etc.

### Package-Specific Source Data

**`meteo-basic-api`** - Core weather data only:
- Temperature, wind speed/direction, precipitation, weather codes
- Pressure, humidity, UV index, precipitation probability
- **Does NOT include**: wave data, wind gusts, marine conditions

**`meteo-wind-api`** - Enhanced wind data only:
- Wind speed/direction, wind gusts, high-altitude wind (80m)
- Air density, pressure data
- **Does NOT include**: wave data, basic temperature/precipitation

**`meteo-sea-api`** - Marine and wave data only:
- Wave heights (significant, wind waves, swell), wave periods, wave directions
- Sea surface temperature, Douglas sea state, wave steepness
- Ocean currents (u/v components), salinity
- **Does NOT include**: basic weather data, wind gusts

**`meteo-solar-api`** - Solar radiation data:
- UV index, sunshine duration, daylight information

**`meteo-agro-api`** - Agricultural weather data:
- Temperature ranges, humidity, precipitation, wind for farming

**`meteo-trend-api`** - Weather trend analysis data

**`meteo-clouds-api`** - Detailed cloud cover data

**`meteo-metadata-api`** - Forecast metadata (location, model run info)

**`meteo-account-api`** - API usage statistics and account information

### Data Paths
All packages publish to the same SignalK paths but with different source identifiers:
- Hourly: `environment.outside.meteo.forecast.hourly.{parameter}.{index}`
- Daily: `environment.outside.meteo.forecast.daily.{parameter}.{index}`

The source label indicates which Meteoblue package the data originated from, allowing consumers to choose data from specific packages or combine data from multiple sources as needed.

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