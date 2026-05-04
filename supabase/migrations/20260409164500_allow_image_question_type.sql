ALTER TABLE public.role_questions
  DROP CONSTRAINT IF EXISTS role_questions_question_type_check;

ALTER TABLE public.role_questions
  ADD CONSTRAINT role_questions_question_type_check
  CHECK (question_type IN (
    'text',
    'textarea',
    'select',
    'multiselect',
    'checkbox',
    'number',
    'date',
    'email',
    'url',
    'phone',
    'time',
    'datetime',
    'rating',
    'radio',
    'file',
    'image'
  ));
