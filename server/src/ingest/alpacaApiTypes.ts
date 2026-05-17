/** Raw Alpaca Trading API shapes used only by the ingestion pipeline. */

export type AlpacaIngestRawActivity = {
  id: string;
  activity_type: string;
  transaction_time?: string;
  date?: string;
  created_at?: string;
  symbol?: string;
  side?: string;
  qty?: string;
  price?: string;
  net_amount?: string;
  status?: string;
  order_status?: string;
};
