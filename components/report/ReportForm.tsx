'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { Loader2 } from 'lucide-react';

interface ReportQuestion {
  id: string;
  question_key: string;
  question_label: string;
  question_type: 'text' | 'textarea' | 'select' | 'multiselect' | 'checkbox' | 'number' | 'date' |
                 'email' | 'url' | 'phone' | 'time' | 'datetime' | 'rating' | 'radio' | 'file';
  question_description?: string | null;
  placeholder?: string | null;
  options?: string[] | null;
  is_required: boolean;
  help_text?: string | null;
  default_value?: string | null;
  min_value?: number | null;
  max_value?: number | null;
  min_length?: number | null;
  max_length?: number | null;
  pattern?: string | null;
  step?: number | null;
  min_date?: string | null;
  max_date?: string | null;
}

type ReportAnswers = Record<string, string>;

interface User {
  id: string;
  email?: string;
  user_metadata?: {
    full_name?: string;
    avatar_url?: string;
  };
  // Add other user properties as needed
}

export function ReportForm() {
  const [questions, setQuestions] = useState<ReportQuestion[]>([]);
  const [answers, setAnswers] = useState<ReportAnswers>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [formError, setFormError] = useState<string | null>(null);
  const { toast } = useToast();
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        setAuthLoading(true);
        const { data: { user }, error } = await supabase.auth.getUser();
        
        if (error) throw error;
        if (!user) {
          toast({
            title: 'Authentication required',
            description: 'Please sign in to submit a report',
            variant: 'destructive',
          });
          return;
        }
        
        setCurrentUser(user as User);
      } catch (error) {
        console.error('Authentication error:', error);
        toast({
          title: 'Authentication error',
          description: 'Failed to verify your session. Please try again.',
          variant: 'destructive',
        });
      } finally {
        setAuthLoading(false);
      }
    };

    checkAuth();
  }, [toast]);

  useEffect(() => {
    if (!currentUser) return;

    // Cancel any pending requests
    const abortController = new AbortController();

    const fetchQuestions = async () => {
      try {
        setIsLoading(true);
        setFormError(null);
        
        const response = await fetch('/api/role-questions', {
          signal: abortController.signal,
        });
        
        if (!response.ok) {
          if (response.status === 401) {
            throw new Error('Please sign in to submit a report');
          }
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data: any[] = await response.json();
        if (!Array.isArray(data)) {
          throw new Error('Invalid response format');
        }
        
        // Use the questions directly from the API
        const mappedQuestions: ReportQuestion[] = data.map((q: any) => ({
          id: q.id,
          question_key: q.question_key,
          question_label: q.question_label,
          question_type: q.question_type,
          question_description: q.question_description,
          placeholder: q.placeholder,
          options: q.options || null,
          is_required: q.is_required || false,
          help_text: q.help_text,
          default_value: q.default_value,
          min_value: q.min_value,
          max_value: q.max_value,
          min_length: q.min_length,
          max_length: q.max_length,
          pattern: q.pattern,
          step: q.step,
          min_date: q.min_date,
          max_date: q.max_date,
        }));
        
        setQuestions(mappedQuestions);
        
        // Initialize answers based on question type and default values
        const initialAnswers = mappedQuestions.reduce<ReportAnswers>((acc, q) => {
          if (q.question_type === 'multiselect') {
            acc[q.id] = '[]'; // JSON array for multiselect
          } else if (q.default_value) {
            acc[q.id] = q.default_value; // Use default value if provided
          } else {
          acc[q.id] = '';
          }
          return acc;
        }, {});
        
        setAnswers(initialAnswers);
      } catch (error) {
        // Don't set error if request was aborted
        if (error instanceof Error && error.name === 'AbortError') {
          return;
        }
        console.error('Error fetching questions:', error);
        setFormError(error instanceof Error ? error.message : 'Failed to load report questions. Please try again later.');
      } finally {
        if (!abortController.signal.aborted) {
          setIsLoading(false);
        }
      }
    };

    fetchQuestions();

    // Cleanup: abort request on unmount or dependency change
    return () => {
      abortController.abort();
    };
  }, [currentUser?.id]); // Use specific property instead of whole object

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('Not authenticated');
      }

      // Create the report
      const { data: report, error: reportError } = await supabase
        .from('reports')
        .insert([{ user_id: user.id }])
        .select()
        .single();

      if (reportError) throw reportError;

      // Save each answer
      const answerPromises = questions.map((question) => {
        let answerValue = answers[question.id] || '';
        
        // For multiselect/checkbox, ensure it's a valid JSON string
        if ((question.question_type === 'multiselect' || question.question_type === 'checkbox') && answerValue) {
          try {
            // Validate it's valid JSON
            JSON.parse(answerValue);
          } catch {
            // If not valid JSON, wrap it
            answerValue = JSON.stringify([answerValue]);
          }
        }
        
        return supabase
          .from('report_answers')
          .insert([{
            report_id: report.id,
            question_id: question.id,
            answer: answerValue
          }]);
      });

      await Promise.all(answerPromises);

      toast({
        title: 'Success',
        description: 'Your report has been submitted successfully!',
      });

      // Reset form
      setAnswers(
        questions.reduce((acc, q) => {
          if (q.question_type === 'multiselect' || q.question_type === 'checkbox') {
            acc[q.id] = '[]';
          } else {
          acc[q.id] = '';
          }
          return acc;
        }, {} as Record<string, string>)
      );
    } catch (error) {
      console.error('Error submitting report:', error);
      toast({
        title: 'Error',
        description: 'Failed to submit report',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (authLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto" />
          <p>Verifying your session...</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="animate-pulse space-y-2">
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            <div className="h-10 bg-gray-100 rounded"></div>
          </div>
        ))}
      </div>
    );
  }

  if (formError) {
    return (
      <div className="p-4 bg-red-50 rounded-md">
        <p className="text-red-700">{formError}</p>
        <Button 
          variant="outline" 
          className="mt-4"
          onClick={() => window.location.reload()}
        >
          Retry
        </Button>
      </div>
    );
  }

  if (!questions.length && !isLoading) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">No questions available for your role.</p>
        <p className="text-sm text-gray-400 mt-2">Please contact your administrator to set up questions for your role.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {formError && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-md">
          <p className="text-red-700">{formError}</p>
        </div>
      )}
      
      {questions.map((question) => {
        // Evaluate conditional logic (if implemented)
        // For now, all questions are shown
        const shouldShow = true // TODO: Implement conditional logic evaluation
        
        if (!shouldShow) return null
        
        return (
        <div key={question.id} className="space-y-2">
          <Label 
            htmlFor={`question-${question.id}`}
            className="text-sm font-medium"
          >
            {question.question_label}
            {question.is_required && <span className="text-destructive ml-1">*</span>}
          </Label>
          
          {question.question_description && (
            <p className="text-xs text-muted-foreground">
              {question.question_description}
            </p>
          )}
          
          {/* Text Input */}
          {question.question_type === 'text' && (
            <Input
              id={`question-${question.id}`}
              type="text"
              value={answers[question.id] || ''}
              onChange={(e) =>
                setAnswers((prev) => ({
                  ...prev,
                  [question.id]: e.target.value,
                }))
              }
              placeholder={question.placeholder || ''}
              required={question.is_required}
              disabled={isSubmitting}
            />
          )}
          
          {/* Textarea */}
          {question.question_type === 'textarea' && (
            <Textarea
              id={`question-${question.id}`}
              value={answers[question.id] || ''}
              onChange={(e) =>
                setAnswers((prev) => ({
                  ...prev,
                  [question.id]: e.target.value,
                }))
              }
              placeholder={question.placeholder || ''}
              rows={4}
              required={question.is_required}
              disabled={isSubmitting}
            />
          )}
          
          {/* Select (Dropdown) */}
          {question.question_type === 'select' && question.options && (
            <Select
              value={answers[question.id] || ''}
              onValueChange={(value) =>
                setAnswers((prev) => ({
                  ...prev,
                  [question.id]: value,
                }))
              }
              required={question.is_required}
              disabled={isSubmitting}
            >
              <SelectTrigger>
                <SelectValue placeholder={question.placeholder || 'Select an option'} />
              </SelectTrigger>
              <SelectContent>
                {question.options.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          
          {/* Multiselect (Checkboxes) */}
          {question.question_type === 'multiselect' && question.options && (
            <div className="space-y-3">
              {question.options.map((option) => {
                const currentAnswers = answers[question.id] 
                  ? (() => {
                      try {
                        return JSON.parse(answers[question.id]);
                      } catch {
                        return [];
                      }
                    })()
                  : [];
                const isChecked = Array.isArray(currentAnswers) && currentAnswers.includes(option);
                
                return (
                  <div key={option} className="flex items-center space-x-2">
                    <Checkbox
                      id={`${question.id}-${option}`}
                      checked={isChecked}
                      onCheckedChange={(checked) => {
                        const current = answers[question.id] 
                          ? (() => {
                              try {
                                return JSON.parse(answers[question.id]);
                              } catch {
                                return [];
                              }
                            })()
                          : [];
                        const newAnswers = checked
                          ? [...current, option]
                          : current.filter((a: string) => a !== option);
                        setAnswers((prev) => ({
                          ...prev,
                          [question.id]: JSON.stringify(newAnswers),
                        }));
                      }}
                      disabled={isSubmitting}
                    />
                    <Label
                      htmlFor={`${question.id}-${option}`}
                      className="text-sm font-normal cursor-pointer"
                    >
                      {option}
                    </Label>
                  </div>
                );
              })}
            </div>
          )}
          
          {/* Checkbox (Single) */}
          {question.question_type === 'checkbox' && (
            <div className="flex items-center space-x-2">
              <Checkbox
                id={`question-${question.id}`}
                checked={answers[question.id] === 'true'}
                onCheckedChange={(checked) =>
                  setAnswers((prev) => ({
                    ...prev,
                    [question.id]: checked ? 'true' : 'false',
                  }))
                }
                disabled={isSubmitting}
              />
              <Label
                htmlFor={`question-${question.id}`}
                className="text-sm font-normal cursor-pointer"
              >
                {question.placeholder || 'Yes'}
              </Label>
            </div>
          )}
          
          {/* Number Input */}
          {question.question_type === 'number' && (
            <Input
              id={`question-${question.id}`}
              type="number"
              value={answers[question.id] || ''}
              onChange={(e) =>
                setAnswers((prev) => ({
                  ...prev,
                  [question.id]: e.target.value,
                }))
              }
              placeholder={question.placeholder || ''}
              required={question.is_required}
              disabled={isSubmitting}
            />
          )}
          
          {/* Date Input */}
          {question.question_type === 'date' && (
            <Input
              id={`question-${question.id}`}
              type="date"
              value={answers[question.id] || ''}
              onChange={(e) =>
                setAnswers((prev) => ({
                  ...prev,
                  [question.id]: e.target.value,
                }))
              }
              min={question.min_date || undefined}
              max={question.max_date || undefined}
              required={question.is_required}
              disabled={isSubmitting}
            />
          )}

          {/* Email Input */}
          {question.question_type === 'email' && (
            <Input
              id={`question-${question.id}`}
              type="email"
              value={answers[question.id] || ''}
              onChange={(e) =>
                setAnswers((prev) => ({
                  ...prev,
                  [question.id]: e.target.value,
                }))
              }
              placeholder={question.placeholder || 'example@email.com'}
              minLength={question.min_length || undefined}
              maxLength={question.max_length || undefined}
              pattern={question.pattern || undefined}
              required={question.is_required}
              disabled={isSubmitting}
            />
          )}

          {/* URL Input */}
          {question.question_type === 'url' && (
            <Input
              id={`question-${question.id}`}
              type="url"
              value={answers[question.id] || ''}
              onChange={(e) =>
                setAnswers((prev) => ({
                  ...prev,
                  [question.id]: e.target.value,
                }))
              }
              placeholder={question.placeholder || 'https://example.com'}
              minLength={question.min_length || undefined}
              maxLength={question.max_length || undefined}
              pattern={question.pattern || undefined}
              required={question.is_required}
              disabled={isSubmitting}
            />
          )}

          {/* Phone Input */}
          {question.question_type === 'phone' && (
            <Input
              id={`question-${question.id}`}
              type="tel"
              value={answers[question.id] || ''}
              onChange={(e) =>
                setAnswers((prev) => ({
                  ...prev,
                  [question.id]: e.target.value,
                }))
              }
              placeholder={question.placeholder || '+1 (555) 123-4567'}
              minLength={question.min_length || undefined}
              maxLength={question.max_length || undefined}
              pattern={question.pattern || undefined}
              required={question.is_required}
              disabled={isSubmitting}
            />
          )}

          {/* Time Input */}
          {question.question_type === 'time' && (
            <Input
              id={`question-${question.id}`}
              type="time"
              value={answers[question.id] || ''}
              onChange={(e) =>
                setAnswers((prev) => ({
                  ...prev,
                  [question.id]: e.target.value,
                }))
              }
              required={question.is_required}
              disabled={isSubmitting}
            />
          )}

          {/* DateTime Input */}
          {question.question_type === 'datetime' && (
            <Input
              id={`question-${question.id}`}
              type="datetime-local"
              value={answers[question.id] || ''}
              onChange={(e) =>
                setAnswers((prev) => ({
                  ...prev,
                  [question.id]: e.target.value,
                }))
              }
              min={question.min_date ? `${question.min_date}T00:00` : undefined}
              max={question.max_date ? `${question.max_date}T23:59` : undefined}
              required={question.is_required}
              disabled={isSubmitting}
            />
          )}

          {/* Radio Buttons */}
          {question.question_type === 'radio' && question.options && (
            <RadioGroup
              value={answers[question.id] || ''}
              onValueChange={(value) =>
                setAnswers((prev) => ({
                  ...prev,
                  [question.id]: value,
                }))
              }
              required={question.is_required}
              disabled={isSubmitting}
            >
              {question.options.map((option) => (
                <div key={option} className="flex items-center space-x-2">
                  <RadioGroupItem value={option} id={`${question.id}-${option}`} />
                  <Label htmlFor={`${question.id}-${option}`} className="cursor-pointer">
                    {option}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          )}

          {/* Rating Scale */}
          {question.question_type === 'rating' && question.options && (
            <div className="flex flex-wrap gap-2">
              {question.options.map((option) => (
                <Button
                  key={option}
                  type="button"
                  variant={answers[question.id] === option ? "default" : "outline"}
                  onClick={() =>
                    setAnswers((prev) => ({
                      ...prev,
                      [question.id]: option,
                    }))
                  }
                  disabled={isSubmitting}
                  className="min-w-[60px]"
                >
                  {option}
                </Button>
              ))}
            </div>
          )}

          {/* File Upload */}
          {question.question_type === 'file' && (
            <Input
              id={`question-${question.id}`}
              type="file"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  // For file uploads, we'll store the file name
                  // In production, you'd want to upload to storage and store the URL
                  setAnswers((prev) => ({
                    ...prev,
                    [question.id]: file.name,
                  }));
                }
              }}
              required={question.is_required}
              disabled={isSubmitting}
            />
          )}

          {/* Help Text */}
          {question.help_text && (
            <p className="text-xs text-muted-foreground mt-1">
              {question.help_text}
            </p>
          )}
        </div>
        )
      })}

      <div className="flex justify-between items-center pt-4 border-t border-gray-200">
        <p className="text-sm text-gray-500">
          {Object.keys(answers).filter(id => {
            const answer = answers[id];
            if (!answer) return false;
            if (answer.trim() === '' || answer === '[]' || answer === 'false') return false;
            return true;
          }).length} of {questions.length} questions answered
        </p>
        <Button 
          type="submit" 
          disabled={isSubmitting || !currentUser}
          className="min-w-[120px]"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Submitting...
            </>
          ) : 'Submit Report'}
        </Button>
      </div>
    </form>
  );
}
