import { supabase } from '../lib/supabase';
import { redirect } from 'react-router-dom';

export const blueprintLoader = async ({ params }) => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    return redirect('/auth');
  }

  const { id } = params;

  // Parallel fetch: Blueprint and All Classes (for sidebar)
  const [blueprintResult, allClassesResult] = await Promise.all([
    supabase
      .from('blueprints')
      .select(`
          *,
          class:classes(id, name, professor),
          document:class_documents(*),
          blueprint_structures(*),
          topic_responses(*),
          document_analyses(*),
          blueprint_topic_resources(
            *,
            resources_from_make(*)
          ),
          blueprint_unit_equations(
            *,
            curated_equations(*)
          ),
          blueprint_unit_figures(
            *,
            curated_figures(*)
          ),
          blueprint_practice_problems(
            unit_id,
            cached_problem:practice_problems_cache(
                problem_statement,
                given_values,
                hints,
                solution_steps,
                final_answer
            )
          ),
          blueprint_deep_dive_solutions(unit_id, solution_markdown)
        `)
      .eq('id', id)
      .single(),
    supabase
      .from('classes')
      .select('id, name')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false })
  ]);

  const blueprint = blueprintResult.data;
  const error = blueprintResult.error;

  if (error || !blueprint) {
    console.error('Error fetching blueprint:', error);
    return redirect('/dashboard');
  }

  // Update last_viewed_at (fire and forget)
  supabase
    .from('blueprints')
    .update({ last_viewed_at: new Date().toISOString() })
    .eq('id', id)
    .then(({ error }) => {
      if (error) console.error('Error updating last_viewed_at:', error);
    });

  return {
    blueprint,
    allClasses: allClassesResult.data || []
  };
};
