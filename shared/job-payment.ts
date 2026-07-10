export const NOT_PAID_REPORT_MESSAGE =
  'Not paid — mark this job as paid before copying or sending the inspection report to the client.';

export function jobRequiresPaymentForReportDelivery(
  agreementStatus: string,
  paymentReceived: boolean,
): boolean {
  return agreementStatus === 'SIGNED' && !paymentReceived;
}
