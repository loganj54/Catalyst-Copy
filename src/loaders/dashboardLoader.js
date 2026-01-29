import { supabase } from '../lib/supabase';
import { redirect } from 'react-router-dom';

export const dashboardLoader = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
        return redirect('/auth');
    }

    const user = session.user;

    // Parallel fetch
    const [classesResult, blueprintsResult] = await Promise.all([
        supabase
            .from('classes')
            .select('*')
            .order('created_at', { ascending: false }),
        supabase
            .from('blueprints')
            .select('*, classes(name)')
            .eq('user_id', user.id)
            .neq('title', 'Untitled Blueprint')
            .order('last_viewed_at', { ascending: false })
            .limit(5)
    ]);

    if (classesResult.error) throw classesResult.error;
    if (blueprintsResult.error) throw blueprintsResult.error;

    // Format classes (matching existing logic)
    const formattedClasses = classesResult.data.map((c) => ({
        id: c.id,
        name: c.name,
        professor: c.professor || '',
        nextExam: 'TBD',
        progress: 'On Track'
    }));

    return {
        classes: formattedClasses,
        recentBlueprints: blueprintsResult.data || []
    };
};
