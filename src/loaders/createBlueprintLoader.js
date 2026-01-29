import { supabase } from '../lib/supabase';
import { redirect } from 'react-router-dom';

export const createBlueprintLoader = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
        return redirect('/auth');
    }

    const { data: classes, error } = await supabase
        .from('classes')
        .select('id, name')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching classes:', error);
        return { allClasses: [] };
    }

    return { allClasses: classes || [] };
};
