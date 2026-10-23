import {
  AGENT_LIMIT_BOUNDS,
  AGENT_ROLE_KEYS,
  AGENT_ROLE_LABELS,
  ERROR_POLICIES,
  ERROR_POLICY_LABELS,
  MIN_INSTRUCTIONS_LENGTH,
  TOOL_KEYS,
  TOOL_REGISTRY,
  type AgentLimitsCaps,
  type AgentRoleKey,
  type ErrorPolicy,
  type ToolKey,
} from '@nagaw/shared';
import { FormField, SelectField, TextareaField } from '@/components/form-field';

type Errors = Record<string, string> | undefined;

export interface ConfigurationDefaults {
  instructions: string;
  objectives: string;
  maxSteps: number;
  maxDurationSeconds: number;
  errorPolicy: ErrorPolicy;
  tools: ToolKey[];
}

export function IdentityFields({
  defaults,
  errors,
}: {
  defaults: { name: string; description: string; roleKey: AgentRoleKey };
  errors: Errors;
}) {
  return (
    <>
      <FormField
        label="Nom"
        name="name"
        defaultValue={defaults.name}
        required
        minLength={2}
        maxLength={80}
        error={errors?.name}
      />
      <SelectField
        label="Domaine"
        name="roleKey"
        defaultValue={defaults.roleKey}
        options={AGENT_ROLE_KEYS.map((key) => ({
          value: key,
          label: AGENT_ROLE_LABELS[key],
        }))}
        error={errors?.roleKey}
      />
      <TextareaField
        label="Description"
        name="description"
        defaultValue={defaults.description}
        maxLength={500}
        rows={2}
        error={errors?.description}
      />
    </>
  );
}

export function ConfigurationFields({
  defaults,
  caps,
  errors,
}: {
  defaults: ConfigurationDefaults;
  caps: AgentLimitsCaps;
  errors: Errors;
}) {
  return (
    <>
      <TextareaField
        label="Objectifs"
        name="objectives"
        defaultValue={defaults.objectives}
        maxLength={2000}
        rows={3}
        hint="Ce que l’agent doit obtenir, en quelques lignes."
        error={errors?.objectives}
      />
      <TextareaField
        label="Instructions"
        name="instructions"
        defaultValue={defaults.instructions}
        maxLength={20000}
        rows={8}
        hint={`Comment l’agent doit travailler. Au moins ${MIN_INSTRUCTIONS_LENGTH} caractères pour pouvoir l’activer.`}
        error={errors?.instructions}
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField
          label={`Étapes maximum par exécution (≤ ${caps.maxSteps})`}
          name="maxSteps"
          type="number"
          inputMode="numeric"
          min={AGENT_LIMIT_BOUNDS.maxSteps.min}
          max={caps.maxSteps}
          step={1}
          defaultValue={defaults.maxSteps}
          required
          error={errors?.maxSteps}
        />
        <FormField
          label={`Durée maximum par exécution, en secondes (≤ ${caps.maxDurationSeconds})`}
          name="maxDurationSeconds"
          type="number"
          inputMode="numeric"
          min={AGENT_LIMIT_BOUNDS.maxDurationSeconds.min}
          max={caps.maxDurationSeconds}
          step={1}
          defaultValue={defaults.maxDurationSeconds}
          required
          error={errors?.maxDurationSeconds}
        />
      </div>
      <SelectField
        label="En cas d’erreur"
        name="errorPolicy"
        defaultValue={defaults.errorPolicy}
        options={ERROR_POLICIES.map((policy) => {
          const label = ERROR_POLICY_LABELS[policy];
          return {
            value: policy,
            label: label.charAt(0).toUpperCase() + label.slice(1),
          };
        })}
        error={errors?.errorPolicy}
      />
      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium">Outils autorisés</legend>
        {TOOL_KEYS.map((key) => {
          const tool = TOOL_REGISTRY[key];
          const id = `tool-${key}`;
          return (
            <div key={key} className="flex items-start gap-2 text-sm">
              <input
                id={id}
                type="checkbox"
                name="tools"
                value={key}
                defaultChecked={defaults.tools.includes(key)}
                disabled={!tool.available}
                className="mt-1"
              />
              <label htmlFor={id} className="flex flex-col">
                <span className="font-medium">
                  {tool.label}
                  {!tool.available && ' — bientôt disponible'}
                </span>
                <span className="text-zinc-600 dark:text-zinc-400">
                  {tool.description}
                </span>
              </label>
            </div>
          );
        })}
        {errors?.tools && (
          <p className="text-sm text-red-700 dark:text-red-400">
            {errors.tools}
          </p>
        )}
      </fieldset>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Modèle d’IA : non configuré. L’intégration d’un fournisseur d’IA est
        reportée ; aucun modèle n’est appelé.
      </p>
    </>
  );
}
