import type { ApplyStep } from '@/lib/apply/types';

/** GA4 ecommerce item shape (minimal). */
export interface AnalyticsItem {
  item_id: string;
  item_name: string;
  item_category?: string;
  price?: number;
  quantity?: number;
}

export type AnalyticsEventMap = {
  page_view: {
    page_path: string;
    page_title?: string;
  };
  view_item: {
    item_id: string;
    item_name: string;
    country_code: string;
    listing_id: string;
    listing_slug?: string;
    currency?: string;
    value?: number;
    items?: AnalyticsItem[];
  };
  view_blog_post: {
    post_id: string;
    slug: string;
    title: string;
  };
  visa_apply_start_click: {
    country_code: string;
    listing_id: string;
    travellers?: number;
    price_option_id?: string;
  };
  visa_apply_login_prompt: {
    source: 'listing_cta' | 'save_draft' | 'proxy_redirect';
    listing_id?: string;
    country_code?: string;
  };
  visa_apply_enter: {
    country_code: string;
    listing_id: string;
    listing_slug?: string;
    resume?: boolean;
    travellers?: number;
    price_option?: string;
  };
  visa_wizard_step_view: {
    step: ApplyStep;
    listing_id: string;
    country_code: string;
    traveller_count?: number;
    filled_count?: number;
  };
  visa_basic_info_complete: {
    listing_id: string;
    country_code: string;
    traveller_count: number;
    has_profile_selected?: boolean;
  };
  visa_traveller_complete: {
    listing_id: string;
    country_code: string;
    document_slot_count?: number;
  };
  visa_review_proceed_checkout: {
    listing_id: string;
    country_code: string;
    filled_count: number;
    total_travellers: number;
  };
  visa_passport_scan_complete: {
    listing_id?: string;
    country_code?: string;
    confidence?: number;
    warnings_count?: number;
  };
  visa_passport_scan_failed: {
    listing_id?: string;
    country_code?: string;
    error_code?: string;
  };
  visa_document_upload_success: {
    slot_key: string;
    storage: 'idb' | 'server';
    mime_type?: string;
  };
  visa_document_upload_error: {
    slot_key: string;
    error_message?: string;
  };
  begin_checkout: {
    listing_id: string;
    country_code: string;
    currency: string;
    value: number;
    traveller_count: number;
    items?: AnalyticsItem[];
  };
  visa_payment_order_created: {
    listing_id: string;
    country_code: string;
    kind: 'free' | 'order' | 'resume' | 'already_submitted';
    amount?: number;
    currency?: string;
  };
  visa_payment_failed: {
    listing_id: string;
    country_code: string;
    error_description?: string;
    submit_id?: string;
  };
  visa_payment_dismissed: {
    listing_id: string;
    country_code: string;
    submit_id?: string;
  };
  purchase: {
    transaction_id: string;
    currency: string;
    value: number;
    listing_id: string;
    country_code: string;
    traveller_count: number;
    free?: boolean;
    items?: AnalyticsItem[];
  };
  visa_application_submitted: {
    application_id: string;
    listing_id: string;
    country_code: string;
    traveller_count: number;
    value?: number;
    currency?: string;
    free?: boolean;
  };
  auth_otp_requested: {
    context: 'signin' | 'apply_modal' | 'checkout' | 'save_draft';
  };
  login: {
    method: 'phone_otp';
    context?: 'signin' | 'apply_modal' | 'checkout' | 'save_draft';
  };
  login_failed: {
    method: 'phone_otp';
    error_code?: 'deactivated' | 'invalid_otp' | 'unknown';
    context?: 'signin' | 'apply_modal' | 'checkout' | 'save_draft';
  };
  visa_submission_confirmation_view: {
    application_id: string;
  };
  visa_correction_started: {
    application_id: string;
    item_count?: number;
  };
  visa_correction_submitted: {
    application_id: string;
    fields_changed_count?: number;
    files_count?: number;
  };
};

export type AnalyticsEventName = keyof AnalyticsEventMap;
