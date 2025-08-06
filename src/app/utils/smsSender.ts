import https from 'https';
import config from '../config';

interface Recipient {
  mobiles: string;
  [key: string]: string; // Additional variables like VAR1, VAR2, etc.
}

interface SendSMSOptions {
  authkey?: string;
  template_id?: string;
  recipients: Recipient[];
  short_url?: '1' | '0'; // 1 for On, 0 for Off
  realTimeResponse?: '1' | '0'; // Optional
}

export const sendMobileSms = async (options: SendSMSOptions): Promise<void> => {
  const requestOptions = {
    method: 'POST',
    hostname: 'control.msg91.com',
    port: null,
    path: '/api/v5/flow',
    headers: {
      authkey: config.sms_auth_key,
      accept: 'application/json',
      'content-type': 'application/json',
    },
  };

  const payload = JSON.stringify({
    template_id: '66d951d1d6fc05421f317ee2',
    short_url: options.short_url || '0', // Default to Off
    realTimeResponse: options.realTimeResponse || '0', // Default to Off
    recipients: options.recipients,
  });

  return new Promise<void>((resolve, reject) => {
    try {
      const req = https.request(requestOptions, res => {
        const chunks: Buffer[] = [];

        res.on('data', chunk => {
          chunks.push(chunk);
        });

        res.on('end', () => {
          const body = Buffer.concat(chunks).toString();
          console.log('SMS Response:', body);
          resolve(); // Resolve the promise on success
        });
      });

      req.write(payload);
      req.end();

      req.on('error', e => {
        console.error(`Problem with SMS request: ${e.message}`);
        reject(e); // Reject the promise on error
      });
    } catch (error) {
      console.error('Unexpected error occurred:', error);
      reject(error); // Reject the promise if an unexpected error occurs
    }
  });
};
