revoke execute on function public.get_door_keypad_config() from anon;
revoke execute on function public.update_door_keypad_config(text, smallint, boolean, text, text) from anon;
revoke execute on function public.request_remote_door_open(uuid, text, text) from anon;

grant execute on function public.get_door_keypad_config() to authenticated;
grant execute on function public.update_door_keypad_config(text, smallint, boolean, text, text) to authenticated;
grant execute on function public.request_remote_door_open(uuid, text, text) to authenticated;
