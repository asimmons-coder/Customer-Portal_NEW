// FIND THIS CODE (around line 648-661):

      } else if (isAdd) {
        // Insert new employee
        const { data, error } = await supabase
          .from('employee_manager')
          .insert({
            ...cleanedData,
            company_name: companyName,
            status: 'Active'
          })
          .select()
          .single();

// REPLACE WITH THIS:

      } else if (isAdd) {
        // Get company_id from user session
        const { data: { session } } = await supabase.auth.getSession();
        const companyId = session?.user?.app_metadata?.company_id || null;
        
        // Insert new employee with company_id
        const { data, error } = await supabase
          .from('employee_manager')
          .insert({
            ...cleanedData,
            company_name: companyName,
            company_id: companyId,  // ← ADD THIS LINE
            status: 'Active'
          })
          .select()
          .single();