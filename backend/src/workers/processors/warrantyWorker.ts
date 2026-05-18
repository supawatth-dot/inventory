import { Job } from 'bullmq';
import { supabase } from '../../lib/supabase';
import { notify } from '../../lib/webhooks';

export async function processWarrantyCheck(_job: Job) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() + 30);

  const { data: expiring } = await supabase
    .from('assets')
    .select('*')
    .lte('warranty_expiry', cutoff.toISOString().split('T')[0])
    .gte('warranty_expiry', new Date().toISOString().split('T')[0])
    .neq('status', 'retired');

  if (!expiring?.length) return { checked: 0 };

  for (const asset of expiring) {
    const daysLeft = Math.ceil((new Date(asset.warranty_expiry).getTime() - Date.now()) / 86400000);
    await notify(
      'Warranty Expiry Alert',
      `Asset "${asset.name}" (${asset.serial_number || 'no SN'}) warranty expires in ${daysLeft} day(s) on ${asset.warranty_expiry}.`
    );
  }

  return { checked: expiring.length };
}
