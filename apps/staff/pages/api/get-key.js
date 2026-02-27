// apps/staff/pages/api/get-key.js
// API endpoint to fetch DeepSeek API key for TabezaConnect installations

import { NextApiRequest, NextApiResponse } from 'next';

// Your database connection (adjust based on your setup)
// import { db } from '@/lib/db';

// Environment variables (add these to your Vercel dashboard)
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;

// Track usage (optional - for analytics)
async function trackKeyUsage(barId: string, version: string) {
  try {
    // Log to your database or analytics service
    console.log(`API key requested for barId: ${barId}, version: ${version}`);
    
    // Example database logging:
    // await db.usageLogs.create({
    //   barId,
    //   version,
    //   timestamp: new Date(),
    //   ip: req.headers['x-forwarded-for']
    // });
  } catch (error) {
    console.error('Failed to track usage:', error);
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { barId, version } = req.query;

    // Validate required parameters
    if (!barId || typeof barId !== 'string') {
      return res.status(400).json({ error: 'barId is required' });
    }

    if (!version || typeof version !== 'string') {
      return res.status(400).json({ error: 'version is required' });
    }

    // Validate barId format (alphanumeric, no spaces)
    if (!/^[a-zA-Z0-9_-]+$/.test(barId)) {
      return res.status(400).json({ error: 'Invalid barId format' });
    }

    // TODO: Add your database validation here
    // Check if barId exists in your customers database
    // const customer = await db.customers.findUnique({ where: { barId } });
    // if (!customer) {
    //   return res.status(404).json({ error: 'Bar ID not found' });
    // }

    // TODO: Check if installation is authorized
    // You might want to track active installations per barId
    // const activeInstallations = await db.installations.count({ where: { barId, active: true } });
    // if (activeInstallations >= customer.maxInstallations) {
    //   return res.status(403).json({ error: 'Maximum installations reached' });
    // }

    // Track this usage (for analytics)
    await trackKeyUsage(barId as string, version as string);

    // Return the API key
    if (!DEEPSEEK_API_KEY) {
      return res.status(500).json({ error: 'API key not configured' });
    }

    res.status(200).json({
      apiKey: DEEPSEEK_API_KEY,
      expiresAt: null, // You could set an expiration date
      barId: barId,
      version: version,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('get-key API error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
