/**
 * TabezaConnect Version Manager
 * 
 * Handles version control, updates, and compatibility checks
 * Ensures smooth transitions between versions and prevents conflicts
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class VersionManager {
  constructor() {
    this.currentVersion = this.getCurrentVersion();
    this.versionHistory = this.loadVersionHistory();
    this.compatibilityMatrix = this.getCompatibilityMatrix();
  }

  getCurrentVersion() {
    try {
      const packagePath = path.join(__dirname, '../package.json');
      const packageJson = require(packagePath);
      return packageJson.version || '1.7.14';
    } catch (error) {
      return '1.7.14'; // Fallback version
    }
  }

  loadVersionHistory() {
    const historyPath = path.join(__dirname, '../data/version-history.json');
    
    try {
      if (fs.existsSync(historyPath)) {
        return JSON.parse(fs.readFileSync(historyPath, 'utf8'));
      }
    } catch (error) {
      console.log('No version history found, creating new one');
    }

    // Default version history
    return {
      '1.7.14': {
        releaseDate: '2025-03-10',
        changes: [
          'Smart instance management with version awareness',
          'Modern dashboard UI with real-time features',
          'Architecture cleanup (removed redundant watchers)',
          'Enhanced IPC communication with context isolation',
          'Single capture path implementation'
        ],
        compatibility: {
          minCompatibleVersion: '1.7.10',
          maxCompatibleVersion: '1.7.14'
        },
        breaking: false,
        features: {
          dashboard: true,
          smartInstances: true,
          realTimeLogs: true,
          contextIsolation: true
        }
      },
      '1.7.10': {
        releaseDate: '2025-02-15',
        changes: [
          'Initial state synchronization system',
          'Enhanced printer setup wizard',
          'Improved error handling'
        ],
        compatibility: {
          minCompatibleVersion: '1.7.0',
          maxCompatibleVersion: '1.7.14'
        },
        breaking: false
      }
    };
  }

  getCompatibilityMatrix() {
    return {
      // Version ranges that can coexist
      '1.7.0-1.7.9': {
        canCoexist: false,
        reason: 'Pre-dashboard era, different architecture'
      },
      '1.7.10-1.7.13': {
        canCoexist: false,
        reason: 'State synchronization differences'
      },
      '1.7.14+': {
        canCoexist: true,
        reason: 'Smart instance management, version-aware'
      }
    };
  }

  saveVersionHistory() {
    const dataDir = path.join(__dirname, '../data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    const historyPath = path.join(dataDir, 'version-history.json');
    fs.writeFileSync(historyPath, JSON.stringify(this.versionHistory, null, 2));
  }

  addVersionToHistory(versionInfo) {
    this.versionHistory[this.currentVersion] = {
      releaseDate: new Date().toISOString().split('T')[0],
      changes: versionInfo.changes || [],
      compatibility: versionInfo.compatibility || {
        minCompatibleVersion: this.currentVersion,
        maxCompatibleVersion: this.currentVersion
      },
      breaking: versionInfo.breaking || false,
      features: versionInfo.features || {}
    };

    this.saveVersionHistory();
  }

  checkVersionCompatibility(otherVersion) {
    const current = this.parseVersion(this.currentVersion);
    const other = this.parseVersion(otherVersion);

    // Check if versions are in compatible ranges
    for (const [range, config] of Object.entries(this.compatibilityMatrix)) {
      if (this.isVersionInRange(current, range) && this.isVersionInRange(other, range)) {
        return {
          compatible: config.canCoexist,
          reason: config.reason
        };
      }
    }

    // Default: same major version should be compatible
    if (current.major === other.major) {
      return {
        compatible: true,
        reason: 'Same major version'
      };
    }

    return {
      compatible: false,
      reason: 'Different major versions'
    };
  }

  parseVersion(version) {
    const parts = version.split('.').map(Number);
    return {
      major: parts[0] || 0,
      minor: parts[1] || 0,
      patch: parts[2] || 0,
      numeric: (parts[0] || 0) * 10000 + (parts[1] || 0) * 100 + (parts[2] || 0)
    };
  }

  isVersionInRange(version, range) {
    const [min, max] = range.split('-').map(v => this.parseVersion(v.trim()));
    
    if (max) {
      return version.numeric >= min.numeric && version.numeric <= max.numeric;
    } else {
      return version.numeric >= min.numeric;
    }
  }

  getRunningInstances() {
    try {
      const result = execSync('wmic process where "name=\'TabezaConnect.exe\' get ProcessId,CreationDate,ExecutablePath /format:csv', { encoding: 'utf8' });
      const lines = result.trim().split('\n').filter(line => line.includes('TabezaConnect.exe'));
      const instances = [];

      for (const line of lines) {
        const parts = line.split(',');
        if (parts.length >= 3) {
          const pid = parts[1].trim();
          const creationDate = parts[2].trim();
          const exePath = parts[3].trim();
          
          // Try to get version from executable path
          let version = 'unknown';
          try {
            const packagePath = exePath.replace('TabezaConnect.exe', 'package.json');
            if (fs.existsSync(packagePath)) {
              const packageJson = require(packagePath);
              version = packageJson.version || 'unknown';
            }
          } catch (e) {
            // Can't read version
          }

          instances.push({
            pid,
            creationDate,
            path: exePath,
            version,
            timestamp: new Date(creationDate)
          });
        }
      }

      return instances.sort((a, b) => b.timestamp - a.timestamp);
    } catch (error) {
      return [];
    }
  }

  analyzeInstanceConflicts() {
    const instances = this.getRunningInstances();
    const conflicts = [];
    const recommendations = [];

    if (instances.length === 0) {
      return { conflicts: [], recommendations: ['No instances running'] };
    }

    // Check version compatibility
    for (let i = 0; i < instances.length; i++) {
      for (let j = i + 1; j < instances.length; j++) {
        const instance1 = instances[i];
        const instance2 = instances[j];
        
        const compatibility = this.checkVersionCompatibility(instance1.version, instance2.version);
        
        if (!compatibility.compatible) {
          conflicts.push({
            instance1: {
              pid: instance1.pid,
              version: instance1.version,
              age: this.getAge(instance1.timestamp)
            },
            instance2: {
              pid: instance2.pid,
              version: instance2.version,
              age: this.getAge(instance2.timestamp)
            },
            reason: compatibility.reason
          });
        }
      }
    }

    // Generate recommendations
    if (conflicts.length > 0) {
      recommendations.push('Terminate conflicting instances to ensure stability');
      recommendations.push('Use only the latest version for optimal performance');
    } else if (instances.length > 1) {
      recommendations.push('Multiple instances detected - consider terminating extras');
    }

    // Find best instance to keep
    const bestInstance = this.findBestInstance(instances);
    if (bestInstance) {
      recommendations.push(`Keep instance PID ${bestInstance.pid} (Version ${bestInstance.version})`);
    }

    return { conflicts, recommendations, instances, bestInstance };
  }

  findBestInstance(instances) {
    // Sort by version (newer first), then by creation date (newer first)
    return instances.sort((a, b) => {
      const aVersion = this.parseVersion(a.version);
      const bVersion = this.parseVersion(b.version);
      
      if (bVersion.numeric !== aVersion.numeric) {
        return bVersion.numeric - aVersion.numeric;
      }
      
      return b.timestamp - a.timestamp;
    })[0];
  }

  getAge(timestamp) {
    const minutes = Math.round((Date.now() - timestamp.getTime()) / 1000 / 60);
    if (minutes < 60) {
      return `${minutes}min`;
    } else {
      const hours = Math.round(minutes / 60);
      return `${hours}h`;
    }
  }

  generateVersionReport() {
    const analysis = this.analyzeInstanceConflicts();
    
    return `
TabezaConnect Version Report
Generated: ${new Date().toISOString()}
Current Version: ${this.currentVersion}

Running Instances: ${analysis.instances.length}
Conflicts: ${analysis.conflicts.length}

Instance Details:
${analysis.instances.map((instance, index) => 
  `${index + 1}. PID: ${instance.pid} - Version: ${instance.version} - Age: ${this.getAge(instance.timestamp)}`
).join('\n')}

${analysis.conflicts.length > 0 ? `
Conflicts Detected:
${analysis.conflicts.map(conflict => 
  `• PID ${conflict.instance1.pid} (${conflict.instance1.version}) vs PID ${conflict.instance2.pid} (${conflict.instance2.version}) - ${conflict.reason}`
).join('\n')}
` : ''}

Recommendations:
${analysis.recommendations.map(rec => `• ${rec}`).join('\n')}

Version History:
${Object.entries(this.versionHistory).map(([version, info]) => 
  `• ${version} (${info.releaseDate}) - ${info.changes.slice(0, 2).join(', ')}${info.changes.length > 2 ? '...' : ''}`
).join('\n')}
`;
  }
}

module.exports = VersionManager;
