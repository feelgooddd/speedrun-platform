// @/app/lib/types/submission.ts

export interface Game {
  id: string;
  slug: string;
  name: string;
}

export interface Platform {
  id: string;
  slug: string;
  name: string;
  timing_method: string;
}

export interface VariableValue {
  id: string;
  variable_id: string;
  name: string;
  slug: string;
  is_coop: boolean;
  required_players: number | null;
}

export interface Variable {
  id: string;
  slug: string;
  name: string;
  is_subcategory: boolean;
  values: VariableValue[];
}

export interface Category {
  id: string;
  slug: string;
  name: string;
  variables: Variable[];
  subcategories: { 
    id: string; 
    name: string; 
    slug: string 
  }[];
}

export interface Runner {
  id: string;
  username: string;
  display_name: string | null;
  country: string | null;
}

export interface TimeParts {
  h: string;
  m: string;
  s: string;
  ms: string;
}

export interface LevelCategory {
  id: string;
  slug: string;
  name: string;
}

export interface Level {
  id: string;
  slug: string;
  name: string;
  order: number;
  level_categories: LevelCategory[];
}