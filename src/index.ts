import fetch from 'node-fetch';
import {
  SignalKApp,
  SignalKPlugin,
  PluginConfig,
  PluginState,
  Position,
  MeteoblueResponse,
  ProcessedHourlyForecast,
  ProcessedDailyForecast,
  SignalKDelta,
  SubscriptionRequest,
  MeteoblueAccountResponse,
  ProcessedAccountInfo
} from './types';

export = function (app: SignalKApp): SignalKPlugin {
  const plugin: SignalKPlugin = {
    id: 'signalk-meteo',
    name: 'SignalK Meteo Plugin',
    description: 'Position-based weather forecast data from Meteoblue API',
    schema: {},
    start: () => {},
    stop: () => {}
  };

  const state: PluginState = {
    forecastInterval: null,
    accountCheckInterval: null,
    navigationSubscriptions: [],
    currentConfig: undefined,
    currentPosition: null,
    lastForecastUpdate: 0,
    lastAccountCheck: 0,
    forecastEnabled: true,
    accountInfo: null
  };

  // Configuration schema
  plugin.schema = {
    type: 'object',
    required: ['meteoblueApiKey'],
    properties: {
      meteoblueApiKey: {
        type: 'string',
        title: 'Meteoblue API Key',
        description: 'Your Meteoblue API key for weather data access',
        default: ''
      },
      forecastInterval: {
        type: 'number',
        title: 'Forecast Update Interval (minutes)',
        description: 'How often to fetch new forecast data',
        default: 120,
        minimum: 30
      },
      enableBasic1h: {
        type: 'boolean',
        title: 'Enable Basic 1h Package',
        description: 'Basic hourly weather data (temperature, precipitation, wind, etc.)',
        default: true
      },
      enableBasicDay: {
        type: 'boolean',
        title: 'Enable Basic Day Package', 
        description: 'Basic daily weather data (temperature, precipitation, wind, etc.)',
        default: true
      },
      enableWind1h: {
        type: 'boolean',
        title: 'Enable Wind 1h Package',
        description: 'Detailed hourly wind data (gusts, direction variations, etc.)',
        default: true
      },
      enableWindDay: {
        type: 'boolean',
        title: 'Enable Wind Day Package',
        description: 'Daily wind summaries and statistics',
        default: false
      },
      enableSea1h: {
        type: 'boolean', 
        title: 'Enable Sea 1h Package',
        description: 'Hourly marine data (wave height, sea temperature, etc.)',
        default: true
      },
      enableSeaDay: {
        type: 'boolean',
        title: 'Enable Sea Day Package',
        description: 'Daily marine conditions and statistics',
        default: false
      },
      enableSolar1h: {
        type: 'boolean',
        title: 'Enable Solar 1h Package',
        description: 'Hourly solar radiation and UV data',
        default: false
      },
      enableSolarDay: {
        type: 'boolean',
        title: 'Enable Solar Day Package',
        description: 'Daily solar radiation summaries',
        default: false
      },
      enableAgro1h: {
        type: 'boolean',
        title: 'Enable Agro 1h Package',
        description: 'Hourly agricultural weather data',
        default: false
      },
      enableAgroDay: {
        type: 'boolean',
        title: 'Enable Agro Day Package', 
        description: 'Daily agricultural weather summaries',
        default: false
      },
      enableTrend1h: {
        type: 'boolean',
        title: 'Enable Trend 1h Package',
        description: 'Hourly weather trend analysis',
        default: false
      },
      enableClouds1h: {
        type: 'boolean',
        title: 'Enable Clouds 1h Package',
        description: 'Detailed hourly cloud cover data',
        default: false
      },
      enableCloudsDay: {
        type: 'boolean',
        title: 'Enable Clouds Day Package',
        description: 'Daily cloud cover summaries',
        default: false
      },
      altitude: {
        type: 'number',
        title: 'Vessel Altitude (meters)',
        description: 'Altitude above sea level for forecast calculations',
        default: 15
      },
      enablePositionSubscription: {
        type: 'boolean',
        title: 'Subscribe to Position Updates',
        description: 'Automatically update forecasts when vessel position changes significantly',
        default: true
      },
      maxForecastHours: {
        type: 'number',
        title: 'Maximum Hourly Forecast Hours',
        description: 'Maximum number of hourly forecast periods to fetch',
        default: 72,
        minimum: 1,
        maximum: 168
      },
      maxForecastDays: {
        type: 'number',
        title: 'Maximum Daily Forecast Days',
        description: 'Maximum number of daily forecast periods to fetch',
        default: 10,
        minimum: 1,
        maximum: 14
      }
    }
  };

  // Utility functions
  const degToRad = (degrees: number): number => degrees * (Math.PI / 180);
  const celsiusToKelvin = (celsius: number): number => celsius + 273.15;
  const mbToPA = (mb: number): number => mb * 100;
  const mmToM = (mm: number): number => mm / 1000;
  const percentToRatio = (percent: number): number => percent / 100;

  const getSourceLabel = (packageType: string): string => {
    return `meteo-${packageType}-api`;
  };

  const fetchAccountInfo = async (config: PluginConfig): Promise<ProcessedAccountInfo | null> => {
    try {
      const url = `https://my.meteoblue.com/account/usage?apikey=${config.meteoblueApiKey}`;
      app.debug(`Fetching account info from: ${url}`);

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data: MeteoblueAccountResponse = await response.json() as MeteoblueAccountResponse;
      
      // Process the account data
      app.debug(`Account usage data received: ${JSON.stringify(data, null, 2)}`);
      
      // Extract usage info from the response (structure may vary)
      let usageInfo = {
        requests_total: 1000, // Default values
        requests_used: 0,
        requests_remaining: 1000,
        period_start: '',
        period_end: '',
        status: 'active'
      };

      // Try to extract actual usage data from various possible response structures
      if (data.usage) {
        usageInfo = { ...usageInfo, ...data.usage };
      } else if (Array.isArray(data) && data.length > 0) {
        // If response is an array of usage records
        const latest = data[data.length - 1] as any;
        usageInfo = { ...usageInfo, ...latest };
      } else if (typeof data === 'object') {
        // Try to find usage fields directly in the response
        Object.keys(data).forEach(key => {
          if (key.includes('total') || key.includes('used') || key.includes('remaining')) {
            app.debug(`Found potential usage field: ${key} = ${data[key]}`);
          }
        });
      }

      const processedInfo: ProcessedAccountInfo = {
        username: 'Unknown', // Not available in usage API
        email: 'Unknown',    // Not available in usage API
        company: 'Unknown',  // Not available in usage API
        country: 'Unknown',  // Not available in usage API
        timezone: 'Unknown', // Not available in usage API
        totalRequests: usageInfo.requests_total,
        usedRequests: usageInfo.requests_used,
        remainingRequests: usageInfo.requests_remaining,
        usagePercentage: usageInfo.requests_total > 0 
          ? Math.round((usageInfo.requests_used / usageInfo.requests_total) * 100)
          : 0,
        periodStart: usageInfo.period_start,
        periodEnd: usageInfo.period_end,
        status: usageInfo.status,
        lastChecked: new Date().toISOString()
      };

      return processedInfo;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      app.error(`Failed to fetch account info: ${errorMsg}`);
      return null;
    }
  };

  const publishAccountInfo = (accountInfo: ProcessedAccountInfo): void => {
    const sourceLabel = getSourceLabel('account');
    const path = 'environment.outside.meteo.system.account';
    
    const delta: SignalKDelta = {
      context: 'vessels.self',
      updates: [{
        $source: sourceLabel,
        timestamp: new Date().toISOString(),
        values: [{
          path,
          value: accountInfo
        }]
      }]
    };
    
    app.handleMessage(plugin.id, delta);
  };

  const checkApiLimits = (accountInfo: ProcessedAccountInfo): void => {
    const usagePercentage = accountInfo.usagePercentage;
    
    // Clear any existing notifications first
    const notificationPath = 'notifications.meteo.apiUsage';
    
    if (usagePercentage >= 90) {
      // Critical warning at 90%+
      const notification = {
        method: ['visual', 'sound'],
        state: 'alert',
        message: `Meteoblue API usage critical: ${usagePercentage}% used (${accountInfo.remainingRequests} requests remaining)`,
        timestamp: new Date().toISOString()
      };
      
      const delta: SignalKDelta = {
        context: 'vessels.self',
        updates: [{
          $source: getSourceLabel('account'),
          timestamp: new Date().toISOString(),
          values: [{
            path: notificationPath,
            value: notification
          }]
        }]
      };
      
      app.handleMessage(plugin.id, delta);
      app.debug(`API usage alert sent: ${usagePercentage}% used`);
      
    } else if (usagePercentage >= 80) {
      // Warning at 80%+
      const notification = {
        method: ['visual'],
        state: 'warn',
        message: `Meteoblue API usage high: ${usagePercentage}% used (${accountInfo.remainingRequests} requests remaining)`,
        timestamp: new Date().toISOString()
      };
      
      const delta: SignalKDelta = {
        context: 'vessels.self',
        updates: [{
          $source: getSourceLabel('account'),
          timestamp: new Date().toISOString(),
          values: [{
            path: notificationPath,
            value: notification
          }]
        }]
      };
      
      app.handleMessage(plugin.id, delta);
      app.debug(`API usage warning sent: ${usagePercentage}% used`);
      
    } else if (usagePercentage < 80 && state.accountInfo && state.accountInfo.usagePercentage >= 80) {
      // Clear notification when usage drops below threshold
      const notification = {
        method: [],
        state: 'normal',
        message: `Meteoblue API usage normal: ${usagePercentage}% used`,
        timestamp: new Date().toISOString()
      };
      
      const delta: SignalKDelta = {
        context: 'vessels.self',
        updates: [{
          $source: getSourceLabel('account'),
          timestamp: new Date().toISOString(),
          values: [{
            path: notificationPath,
            value: notification
          }]
        }]
      };
      
      app.handleMessage(plugin.id, delta);
    }
  };

  const shouldUpdateForecast = (position: Position): boolean => {
    if (!state.currentPosition || !state.lastForecastUpdate) {
      return true;
    }

    const timeSinceUpdate = Date.now() - state.lastForecastUpdate;
    const updateIntervalMs = (state.currentConfig?.forecastInterval ?? 120) * 60 * 1000;
    
    if (timeSinceUpdate >= updateIntervalMs) {
      return true;
    }

    // Check if position has moved significantly (more than ~5 nautical miles)
    const lat1 = state.currentPosition.latitude;
    const lon1 = state.currentPosition.longitude;
    const lat2 = position.latitude;
    const lon2 = position.longitude;

    const R = 6371000; // Earth's radius in meters
    const dLat = degToRad(lat2 - lat1);
    const dLon = degToRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(degToRad(lat1)) * Math.cos(degToRad(lat2)) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;

    return distance > 9260; // ~5 nautical miles
  };

  const getEnabledPackages = (config: PluginConfig): string[] => {
    const packages: string[] = [];
    
    if (config.enableBasic1h) packages.push('basic-1h');
    if (config.enableBasicDay) packages.push('basic-day');
    if (config.enableWind1h) packages.push('wind-1h');
    if (config.enableWindDay) packages.push('wind-day');
    if (config.enableSea1h) packages.push('sea-1h');
    if (config.enableSeaDay) packages.push('sea-day');
    if (config.enableSolar1h) packages.push('solar-1h');
    if (config.enableSolarDay) packages.push('solar-day');
    if (config.enableAgro1h) packages.push('agro-1h');
    if (config.enableAgroDay) packages.push('agro-day');
    if (config.enableTrend1h) packages.push('trend-1h');
    if (config.enableClouds1h) packages.push('clouds-1h');
    if (config.enableCloudsDay) packages.push('clouds-day');
    
    return packages;
  };

  const buildMeteoblueUrl = (lat: number, lon: number, config: PluginConfig): string => {
    const packages = getEnabledPackages(config);
    
    if (packages.length === 0) {
      throw new Error('No Meteoblue packages enabled in configuration');
    }
    
    const packageStr = packages.join('_');
    
    return `https://my.meteoblue.com/packages/${packageStr}?` +
           `apikey=${config.meteoblueApiKey}&` +
           `lat=${lat}&` +
           `lon=${lon}&` +
           `asl=${config.altitude}&` +
           `format=json`;
  };

  const processHourlyForecast = (data: Record<string, unknown[]> | any, maxHours: number): ProcessedHourlyForecast[] => {
    const forecasts: ProcessedHourlyForecast[] = [];
    
    if (!data || !data.time || !Array.isArray(data.time)) {
      app.error('Invalid hourly forecast data: missing or invalid time array');
      return forecasts;
    }
    
    const now = new Date();
    now.setMinutes(0, 0, 0); // Round to hour

    const count = Math.min(data.time.length, maxHours);
    app.debug(`Processing ${count} hourly forecasts from ${data.time.length} available periods`);
    app.debug(`Available hourly fields: ${Object.keys(data).join(', ')}`);

    for (let i = 0; i < count; i++) {
      const forecastTime = new Date(data.time[i]);
      const relativeHour = Math.round((forecastTime.getTime() - now.getTime()) / (1000 * 60 * 60));

      // Using correct Meteoblue API field names from documentation
      forecasts.push({
        timestamp: data.time[i],
        relativeHour,
        temperature: celsiusToKelvin(data.temperature[i]),
        windSpeed: data.windspeed[i] || 0,
        windDirection: degToRad(data.wind_direction?.[i] || 0),
        precipitation: mmToM(data.precipitation?.[i] || 0),
        weatherCode: data.pictocode?.[i] || 0,
        pressure: mbToPA(data.sea_level_pressure?.[i] || 1013),
        relativeHumidity: percentToRatio(data.humidity?.[i] || 50),
        visibility: 10000, // Not available in basic package, using default
        cloudCover: 0, // Not available in basic package, using default
        uvIndex: data.uv_index?.[i] || 0,
        feltTemperature: celsiusToKelvin(data.felttemperature?.[i] || data.temperature[i]),
        precipitationProbability: percentToRatio(data.precipitation_probability?.[i] || 0)
      });
    }

    return forecasts;
  };

  const processDailyForecast = (data: Record<string, unknown[]> | any, maxDays: number): ProcessedDailyForecast[] => {
    const forecasts: ProcessedDailyForecast[] = [];
    
    if (!data || !data.time || !Array.isArray(data.time)) {
      app.error('Invalid daily forecast data: missing or invalid time array');
      return forecasts;
    }
    
    const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const count = Math.min(data.time.length, maxDays);
    app.debug(`Processing ${count} daily forecasts from ${data.time.length} available periods`);
    app.debug(`Available daily fields: ${Object.keys(data).join(', ')}`);

    for (let i = 0; i < count; i++) {
      const forecastDate = new Date(data.time[i]);
      const dayOfWeek = daysOfWeek[forecastDate.getDay()];

      // Using correct Meteoblue API field names for daily data
      forecasts.push({
        date: data.time[i],
        dayOfWeek,
        temperatureMax: celsiusToKelvin(data.temperature_max?.[i] || data.temperature?.[i] || 20),
        temperatureMin: celsiusToKelvin(data.temperature_min?.[i] || data.temperature?.[i] || 20),
        windSpeedMax: data.windspeed_max?.[i] || data.windspeed?.[i] || 0,
        windDirection: degToRad(data.wind_direction?.[i] || 0),
        precipitation: mmToM(data.precipitation?.[i] || 0),
        weatherCode: data.pictocode?.[i] || 0,
        pressureMean: mbToPA(data.sea_level_pressure?.[i] || 1013),
        relativeHumidityMean: percentToRatio(data.humidity?.[i] || 50),
        visibilityMean: 10000, // Not available in basic package, using default
        cloudCoverMean: 0, // Not available in basic package, using default
        uvIndexMax: data.uv_index?.[i] || 0,
        precipitationProbability: percentToRatio(data.precipitation_probability?.[i] || 0),
        sunshineDuration: 0, // Not available in basic package, using default
        feltTemperatureMax: celsiusToKelvin(data.felttemperature_max?.[i] || data.felttemperature?.[i] || data.temperature?.[i] || 20),
        feltTemperatureMin: celsiusToKelvin(data.felttemperature_min?.[i] || data.felttemperature?.[i] || data.temperature?.[i] || 20)
      });
    }

    return forecasts;
  };

  const publishHourlyForecasts = (forecasts: ProcessedHourlyForecast[], packageType: string): void => {
    const sourceLabel = getSourceLabel(packageType);
    
    // Publish individual parameters for each forecast hour (following SignalK pattern)
    forecasts.forEach((forecast, index) => {
      Object.entries(forecast).forEach(([key, value]) => {
        if (key === 'timestamp') return; // Skip timestamp as it's part of the delta
        
        const path = `environment.outside.meteo.forecast.hourly.${key}.${index}`;
        const delta: SignalKDelta = {
          context: 'vessels.self',
          updates: [{
            $source: sourceLabel,
            timestamp: forecast.timestamp,
            values: [{
              path,
              value
            }]
          }]
        };
        app.handleMessage(plugin.id, delta);
      });
    });
  };

  const publishDailyForecasts = (forecasts: ProcessedDailyForecast[], packageType: string): void => {
    const sourceLabel = getSourceLabel(packageType);
    
    // Publish individual parameters for each forecast day (following SignalK pattern)
    forecasts.forEach((forecast, index) => {
      Object.entries(forecast).forEach(([key, value]) => {
        if (key === 'date') return; // Skip date as it's handled separately
        
        const path = `environment.outside.meteo.forecast.daily.${key}.${index}`;
        const delta: SignalKDelta = {
          context: 'vessels.self',
          updates: [{
            $source: sourceLabel,
            timestamp: new Date().toISOString(),
            values: [{
              path,
              value
            }]
          }]
        };
        app.handleMessage(plugin.id, delta);
      });
    });
  };

  const fetchForecast = async (position: Position, config: PluginConfig): Promise<void> => {
    if (!config.meteoblueApiKey) {
      app.error('Meteoblue API key not configured');
      return;
    }

    try {
      const url = buildMeteoblueUrl(position.latitude, position.longitude, config);
      app.debug(`Fetching forecast from: ${url}`);

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data: MeteoblueResponse = await response.json() as MeteoblueResponse;
      const enabledPackages = getEnabledPackages(config);
      
      app.debug(`Forecast response received. Keys: ${Object.keys(data).join(', ')}`);
      if (data.data_1h) app.debug(`Hourly data available with ${data.data_1h.time?.length || 0} time periods`);
      if (data.data_day) app.debug(`Daily data available with ${data.data_day.time?.length || 0} time periods`);

      // Publish metadata
      const metadataPath = 'environment.outside.meteo.system.metadata';
      const metadataSource = getSourceLabel('metadata');
      const metadataDelta: SignalKDelta = {
        context: 'vessels.self',
        updates: [{
          $source: metadataSource,
          timestamp: new Date().toISOString(),
          values: [{
            path: metadataPath,
            value: data.metadata
          }]
        }]
      };
      app.handleMessage(plugin.id, metadataDelta);

      // Process and publish hourly forecasts for each enabled hourly package
      if (data.data_1h) {
        const hourlyPackages = enabledPackages.filter(pkg => pkg.includes('-1h'));
        if (hourlyPackages.length > 0) {
          const hourlyForecasts = processHourlyForecast(data.data_1h, config.maxForecastHours);
          
          // Publish for each enabled hourly package type
          hourlyPackages.forEach(packageName => {
            const packageType = packageName.replace('-1h', '');
            publishHourlyForecasts(hourlyForecasts, packageType);
          });
          
          app.debug(`Published ${hourlyForecasts.length} hourly forecasts for packages: ${hourlyPackages.join(', ')}`);
        }
      }

      // Process and publish daily forecasts for each enabled daily package  
      if (data.data_day) {
        const dailyPackages = enabledPackages.filter(pkg => pkg.includes('-day'));
        if (dailyPackages.length > 0) {
          const dailyForecasts = processDailyForecast(data.data_day, config.maxForecastDays);
          
          // Publish for each enabled daily package type
          dailyPackages.forEach(packageName => {
            const packageType = packageName.replace('-day', '');
            publishDailyForecasts(dailyForecasts, packageType);
          });
          
          app.debug(`Published ${dailyForecasts.length} daily forecasts for packages: ${dailyPackages.join(', ')}`);
        }
      }

      state.lastForecastUpdate = Date.now();
      state.currentPosition = { ...position };
      
      app.setProviderStatus(`Last updated: ${new Date().toLocaleString()}`);

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      app.error(`Failed to fetch forecast: ${errorMsg}`);
      app.setProviderStatus(`Error: ${errorMsg}`);
    }
  };

  const subscribeToPosition = (config: PluginConfig): void => {
    if (!config.enablePositionSubscription) {
      app.debug('Position subscription disabled in config');
      return;
    }

    app.debug('Setting up position subscription');

    const subscription: SubscriptionRequest = {
      context: 'vessels.self',
      subscribe: [{
        path: 'navigation.position',
        period: 60000, // Check position every minute
        format: 'delta'
      }]
    };

    // const unsubscribe = () => {};
    
    app.subscriptionmanager.subscribe(
      subscription,
      state.navigationSubscriptions,
      (err) => {
        app.error(`Position subscription error: ${err}`);
        app.debug('Position subscription failed - forecast updates will only be periodic');
      },
      (delta) => {
        try {
          app.debug('Received position update from subscription');
          const positionUpdate = delta.updates[0]?.values?.find(v => v.path === 'navigation.position');
          if (positionUpdate?.value && typeof positionUpdate.value === 'object') {
            const posValue = positionUpdate.value as { latitude: number; longitude: number };
            const position: Position = {
              latitude: posValue.latitude,
              longitude: posValue.longitude,
              timestamp: new Date()
            };

            app.debug(`Position received: ${position.latitude}, ${position.longitude}`);
            
            // Store the position for initial forecast if we don't have one
            if (!state.currentPosition) {
              state.currentPosition = position;
              app.debug('Stored initial position for forecasting');
            }

            if (shouldUpdateForecast(position) && state.currentConfig) {
              app.debug(`Position changed significantly, updating forecast`);
              fetchForecast(position, state.currentConfig);
            }
          } else {
            app.debug('Position update received but no valid position data found');
          }
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          app.error(`Error processing position update: ${errorMsg}`);
        }
      }
    );
  };

  // Plugin lifecycle
  plugin.start = (options: Partial<PluginConfig>) => {
    const config: PluginConfig = {
      meteoblueApiKey: '',
      forecastInterval: 120,
      altitude: 15,
      enablePositionSubscription: true,
      maxForecastHours: 72,
      maxForecastDays: 10,
      // Default packages: basic, wind, and sea enabled
      enableBasic1h: true,
      enableBasicDay: true,
      enableWind1h: true,
      enableWindDay: false,
      enableSea1h: true,
      enableSeaDay: false,
      enableSolar1h: false,
      enableSolarDay: false,
      enableAgro1h: false,
      enableAgroDay: false,
      enableTrend1h: false,
      enableClouds1h: false,
      enableCloudsDay: false,
      ...options
    };

    state.currentConfig = config;

    if (!config.meteoblueApiKey) {
      app.error('Meteoblue API key is required');
      app.setProviderStatus('Configuration error: API key required');
      return;
    }

    app.debug('Starting Meteo plugin');
    app.setProviderStatus('Initializing...');

    // Validate API key and fetch initial account info
    setTimeout(async () => {
      const accountInfo = await fetchAccountInfo(config);
      if (accountInfo) {
        state.accountInfo = accountInfo;
        publishAccountInfo(accountInfo);
        checkApiLimits(accountInfo);
        app.debug(`API key validated. Usage: ${accountInfo.usagePercentage}% (${accountInfo.remainingRequests} requests remaining)`);
        app.setProviderStatus(`Active - ${accountInfo.remainingRequests} API requests remaining`);
      } else {
        app.setProviderStatus('Warning: Could not validate API key');
      }
    }, 2000);

    // Subscribe to position updates
    subscribeToPosition(config);

    // Set up periodic forecast updates
    const intervalMs = config.forecastInterval * 60 * 1000;
    state.forecastInterval = setInterval(async () => {
      if (state.currentPosition && state.forecastEnabled) {
        app.debug('Periodic forecast update');
        await fetchForecast(state.currentPosition, config);
      }
    }, intervalMs);

    // Set up periodic account checking (every 6 hours)
    state.accountCheckInterval = setInterval(async () => {
      const accountInfo = await fetchAccountInfo(config);
      if (accountInfo) {
        state.accountInfo = accountInfo;
        publishAccountInfo(accountInfo);
        checkApiLimits(accountInfo);
        app.debug(`Account info updated. Usage: ${accountInfo.usagePercentage}%`);
      }
    }, 6 * 60 * 60 * 1000); // 6 hours

    // Initial forecast fetch (try to get current position first)
    setTimeout(async () => {
      // If we have a stored position or can get current position, fetch immediately
      if (state.currentPosition) {
        await fetchForecast(state.currentPosition, config);
      } else {
        app.debug('No position available yet, will wait for position subscription or manual trigger');
        // For testing, you could add a hardcoded position here:
        // const testPosition = { latitude: 37.7749, longitude: -122.4194, timestamp: new Date() };
        // await fetchForecast(testPosition, config);
      }
    }, 5000); // Wait 5 seconds for position subscription to establish

    app.setProviderStatus('Active');
  };

  plugin.stop = () => {
    app.debug('Stopping Meteo plugin');

    // Clear intervals
    if (state.forecastInterval) {
      clearInterval(state.forecastInterval);
      state.forecastInterval = null;
    }
    
    if (state.accountCheckInterval) {
      clearInterval(state.accountCheckInterval);
      state.accountCheckInterval = null;
    }

    // Clean up subscriptions
    state.navigationSubscriptions.forEach(unsubscribe => unsubscribe());
    state.navigationSubscriptions = [];

    // Reset state
    state.currentConfig = undefined;
    state.currentPosition = null;
    state.lastForecastUpdate = 0;
    state.lastAccountCheck = 0;
    state.accountInfo = null;

    app.setProviderStatus('Stopped');
  };

  return plugin;
};