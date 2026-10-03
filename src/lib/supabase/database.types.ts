// Hand-written to match supabase/migrations (0001_init.sql to 0006_owner_emails.sql), in the
// shape `supabase gen types typescript` produces. Only the tables the app uses so far.

export type UnitLabel = "per_unit" | "per_building" | "per_sq_ft";
export type ReplacementScenario = "run_to_failure" | "replace_now";
export type ComponentCondition = "good" | "fair" | "poor";
export type TypicalCostPer = "apartment" | "sq_ft";

export type PropertyRow = {
  id: string;
  user_id: string;
  name: string;
  city: string | null;
  state: string | null;
  unit_count: number;
  year_built: number | null;
  created_at: string;
  updated_at: string;
};

export type ComponentRow = {
  id: string;
  property_id: string;
  library_slug: string | null;
  category: string;
  name: string;
  quantity: number;
  unit_label: UnitLabel;
  install_year: number | null;
  useful_life_years: number;
  replacement_cost_each: number | null;
  condition: ComponentCondition | null;
  notes: string | null;
  /**
   * The owner ticked "guess" next to the install year. Added by 0004, so it's missing
   * from rows read from a database that hasn't had that update yet.
   */
  install_year_is_estimate?: boolean;
  scenario: ReplacementScenario;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type ComponentLibraryRow = {
  id: string;
  slug: string;
  category: string;
  name: string;
  default_useful_life_low: number;
  default_useful_life_high: number;
  default_unit_label: UnitLabel;
  description: string | null;
  sort_order: number;
  /** 0005: typical installed cost range, in today's dollars. All three are null or all are set. */
  typical_cost_low: number | null;
  typical_cost_high: number | null;
  typical_cost_per: TypicalCostPer | null;
};

/** 0006: a founding member. Owners can read their own row; only the dashboard (later Stripe) writes it. */
export type MembershipRow = {
  user_id: string;
  active: boolean;
  note: string | null;
  created_at: string;
  updated_at: string;
};

/** 0006: which automatic emails an account gets. No row means all three are on. */
export type EmailSettingsRow = {
  user_id: string;
  reminders: boolean;
  budget_summary: boolean;
  condition_report: boolean;
  unsubscribe_token: string;
  created_at: string;
  updated_at: string;
};

/** The three switches, the only columns an owner may write. */
export type EmailSwitches = Pick<EmailSettingsRow, "reminders" | "budget_summary" | "condition_report">;

/** 0006: one email sent. Only the daily sender (secret key) reads or writes it. */
export type EmailLogRow = {
  id: string;
  user_id: string;
  kind: "reminder" | "budget_summary" | "condition_report";
  year: number;
  component_id: string | null;
  sent_at: string;
};

/** One component as sent to save_property. `id` only for rows already saved. */
export type SaveComponentInput = {
  id?: string;
  library_slug: string | null;
  category: string;
  name: string;
  quantity: number;
  unit_label: UnitLabel;
  install_year: number | null;
  useful_life_years: number;
  replacement_cost_each: number | null;
  /**
   * 0004: these three are stored only once that update has run. Earlier databases
   * drop them without an error, which the editor's read-back check catches.
   */
  condition: ComponentCondition | null;
  notes: string | null;
  install_year_is_estimate: boolean;
  scenario: ReplacementScenario;
  sort_order: number;
};

export type SavePropertyInput = {
  id?: string;
  name: string;
  city?: string | null;
  state?: string | null;
  unit_count: number;
  year_built: number | null;
};

export type Database = {
  public: {
    Tables: {
      properties: {
        Row: PropertyRow;
        Insert: Partial<PropertyRow> & Pick<PropertyRow, "name">;
        Update: Partial<PropertyRow>;
        Relationships: [];
      };
      components: {
        Row: ComponentRow;
        Insert: Partial<ComponentRow> &
          Pick<ComponentRow, "property_id" | "category" | "name" | "quantity" | "useful_life_years">;
        Update: Partial<ComponentRow>;
        Relationships: [
          {
            foreignKeyName: "components_property_id_fkey";
            columns: ["property_id"];
            isOneToOne: false;
            referencedRelation: "properties";
            referencedColumns: ["id"];
          },
        ];
      };
      component_library: {
        Row: ComponentLibraryRow;
        Insert: Partial<ComponentLibraryRow> &
          Pick<
            ComponentLibraryRow,
            "slug" | "category" | "name" | "default_useful_life_low" | "default_useful_life_high" | "default_unit_label"
          >;
        Update: Partial<ComponentLibraryRow>;
        Relationships: [];
      };
      memberships: {
        Row: MembershipRow;
        Insert: Partial<MembershipRow> & Pick<MembershipRow, "user_id">;
        Update: Partial<MembershipRow>;
        Relationships: [];
      };
      email_settings: {
        Row: EmailSettingsRow;
        Insert: Partial<EmailSwitches> & { user_id?: string };
        Update: Partial<EmailSwitches>;
        Relationships: [];
      };
      email_log: {
        Row: EmailLogRow;
        Insert: Omit<EmailLogRow, "id" | "sent_at"> & { id?: string; sent_at?: string };
        Update: Partial<EmailLogRow>;
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      save_property: {
        Args: {
          p_property: SavePropertyInput;
          p_components: SaveComponentInput[];
          /** 0002: refuse the save (PT409) if the property was saved since this version. */
          p_expected_updated_at?: string | null;
        };
        Returns: string;
      };
      /** 0006: what an unsubscribe link calls. False when the token matches no account. */
      email_unsubscribe: {
        Args: { p_token: string; p_kind: string };
        Returns: boolean;
      };
    };
    Enums: {
      unit_label: UnitLabel;
      replacement_scenario: ReplacementScenario;
      component_condition: ComponentCondition;
    };
    CompositeTypes: { [_ in never]: never };
  };
};
