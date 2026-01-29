import { supabase } from '../lib/supabase';
import { redirect } from 'react-router-dom';

export const classDetailsLoader = async ({ params }) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
        return redirect('/auth');
    }

    const { id } = params;

    // Parallel fetch: Class Details, Blueprints, Documents, All Classes (for sidebar)
    const [classResult, blueprintsResult, documentsResult, allClassesResult] = await Promise.all([
        supabase
            .from('classes')
            .select('*')
            .eq('id', id)
            .single(),
        supabase
            .from('blueprints')
            .select('*')
            .eq('class_id', id)
            .order('created_at', { ascending: false }),
        supabase
            .from('class_documents')
            .select('*')
            .eq('class_id', id)
            .order('created_at', { ascending: false }),
        supabase
            .from('classes')
            .select('id, name')
            .eq('user_id', session.user.id)
            .order('created_at', { ascending: false })
    ]);

    if (classResult.error) {
        // If class not found, redirect to dashboard
        return redirect('/dashboard');
    }

    return {
        classData: classResult.data,
        blueprints: blueprintsResult.data || [],
        documents: documentsResult.data || [],
        allClasses: allClassesResult.data || []
    };
};
