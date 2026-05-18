import { Job } from 'bullmq';
import { supabase } from '../../lib/supabase';
import { notify } from '../../lib/webhooks';
import { sendEmail } from '../../lib/mailer';

export async function processLicenseCheck(_job: Job) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 45);

  const { data: unused } = await supabase
    .from('licenses')
    .select('*')
    .lt('last_used_at', cutoff.toISOString())
    .eq('status', 'active');

  if (!unused?.length) return { checked: 0 };

  for (const license of unused) {
    const message = `License "${license.software_name}" has not been used in over 45 days. Consider reclaiming or cancelling.`;
    await notify('Unused License Alert', message);
    if (license.owner_email) {
      await sendEmail(license.owner_email, 'Unused License Review Required', `<p>${message}</p>`);
    }
  }

  return { checked: unused.length };
}
