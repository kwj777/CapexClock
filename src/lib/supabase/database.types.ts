// Hand-written to match supabase/migrations (0001_init.sql, 0002_safer_saves.sql), in the shape
// `supabase gen types typescript` produces. Only the tables the app uses so far.

export type UnitLabel = "per_unit" | "per_building" | "per_sq_ft";
export type ReplacementScenario = "run_to_failure" | "replace_now";
export type ComponentCondition = "good" | "fair" | "poor";

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
    };
    Enums: {
      unit_label: UnitLabel;
      replacement_scenario: ReplacementScenario;
      component_condition: ComponentCondition;
    };
    CompositeTypes: { [_ in never]: never };
  };
};
