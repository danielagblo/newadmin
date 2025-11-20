# Django Feedback Model Suggestion

This document provides a Django model and serializer suggestion for the Feedback feature that has been implemented in the Next.js admin panel.

## Model

Create a new file `models.py` or add to your existing models file:

```python
from django.db import models
from django.contrib.auth import get_user_model

User = get_user_model()

class Feedback(models.Model):
    CATEGORY_CHOICES = [
        ('BUG', 'Bug Report'),
        ('FEATURE', 'Feature Request'),
        ('IMPROVEMENT', 'Improvement Suggestion'),
        ('COMPLAINT', 'Complaint'),
        ('OTHER', 'Other'),
    ]
    
    STATUS_CHOICES = [
        ('PENDING', 'Pending'),
        ('IN_REVIEW', 'In Review'),
        ('RESOLVED', 'Resolved'),
        ('REJECTED', 'Rejected'),
    ]
    
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='feedbacks')
    subject = models.CharField(max_length=200)
    message = models.TextField()
    category = models.CharField(max_length=20, choices=CATEGORY_CHOICES, default='OTHER')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='PENDING')
    admin_response = models.TextField(blank=True, null=True, help_text='Response visible to user')
    admin_notes = models.TextField(blank=True, null=True, help_text='Internal notes only')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Feedback'
        verbose_name_plural = 'Feedbacks'
    
    def __str__(self):
        return f"{self.subject} - {self.user.email} ({self.status})"
```

## Serializer

Create a serializer in your `serializers.py`:

```python
from rest_framework import serializers
from .models import Feedback
from django.contrib.auth import get_user_model

User = get_user_model()

class UserSerializer(serializers.ModelSerializer):
    """Minimal user serializer for feedback"""
    class Meta:
        model = User
        fields = ['id', 'email', 'name', 'phone']

class FeedbackSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)
    user_id = serializers.IntegerField(write_only=True, required=False)
    
    class Meta:
        model = Feedback
        fields = [
            'id', 'user', 'user_id', 'subject', 'message', 
            'category', 'status', 'admin_response', 'admin_notes',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['created_at', 'updated_at']
    
    def create(self, validated_data):
        # If user_id is provided, use it; otherwise use request.user
        user_id = validated_data.pop('user_id', None)
        if user_id:
            validated_data['user_id'] = user_id
        elif self.context['request'].user.is_authenticated:
            validated_data['user'] = self.context['request'].user
        return super().create(validated_data)

class FeedbackCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating feedback (from mobile app)"""
    class Meta:
        model = Feedback
        fields = ['subject', 'message', 'category']
    
    def create(self, validated_data):
        validated_data['user'] = self.context['request'].user
        return super().create(validated_data)
```

## ViewSet

Create a ViewSet in your `views.py`:

```python
from rest_framework import viewsets, filters
from rest_framework.permissions import IsAuthenticated, IsAdminUser
from django_filters.rest_framework import DjangoFilterBackend
from .models import Feedback
from .serializers import FeedbackSerializer, FeedbackCreateSerializer

class FeedbackViewSet(viewsets.ModelViewSet):
    queryset = Feedback.objects.all()
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['status', 'category']
    search_fields = ['subject', 'message', 'user__email', 'user__name']
    ordering_fields = ['created_at', 'updated_at']
    ordering = ['-created_at']
    
    def get_serializer_class(self):
        if self.action == 'create':
            return FeedbackCreateSerializer
        return FeedbackSerializer
    
    def get_permissions(self):
        if self.action in ['list', 'retrieve', 'update', 'partial_update', 'destroy']:
            # Only admins can view and manage feedback
            return [IsAdminUser()]
        elif self.action == 'create':
            # Any authenticated user can create feedback
            return [IsAuthenticated()]
        return super().get_permissions()
    
    def get_queryset(self):
        queryset = super().get_queryset()
        # Admins see all feedback
        if self.request.user.is_staff or self.request.user.is_superuser:
            return queryset
        # Regular users only see their own feedback
        return queryset.filter(user=self.request.user)
```

## URLs

Add to your `urls.py`:

```python
from rest_framework.routers import DefaultRouter
from .views import FeedbackViewSet

router = DefaultRouter()
router.register(r'feedback', FeedbackViewSet, basename='feedback')
router.register(r'admin/feedback', FeedbackViewSet, basename='admin-feedback')

urlpatterns = [
    # ... your other URLs
] + router.urls
```

## Admin Registration

Register in `admin.py`:

```python
from django.contrib import admin
from .models import Feedback

@admin.register(Feedback)
class FeedbackAdmin(admin.ModelAdmin):
    list_display = ['id', 'subject', 'user', 'category', 'status', 'created_at']
    list_filter = ['status', 'category', 'created_at']
    search_fields = ['subject', 'message', 'user__email', 'user__name']
    readonly_fields = ['created_at', 'updated_at']
    fieldsets = (
        ('Feedback Information', {
            'fields': ('user', 'subject', 'message', 'category')
        }),
        ('Status & Response', {
            'fields': ('status', 'admin_response', 'admin_notes')
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )
```

## API Endpoints

After implementing the above, the following endpoints will be available:

- `GET /api-v1/feedback/` - List feedback (admin only, or user's own feedback)
- `POST /api-v1/feedback/` - Create feedback (authenticated users)
- `GET /api-v1/feedback/{id}/` - Get feedback details
- `PUT /api-v1/feedback/{id}/` - Update feedback (admin only)
- `DELETE /api-v1/feedback/{id}/` - Delete feedback (admin only)
- `GET /api-v1/admin/feedback/` - Admin endpoint (same as above)

## Query Parameters

- `status` - Filter by status (PENDING, IN_REVIEW, RESOLVED, REJECTED)
- `category` - Filter by category (BUG, FEATURE, IMPROVEMENT, COMPLAINT, OTHER)
- `search` - Search in subject, message, user email, user name
- `ordering` - Order by created_at, updated_at (use `-` for descending)

## Next Steps

1. Create the model in your Django app
2. Run migrations: `python manage.py makemigrations` and `python manage.py migrate`
3. Create the serializer and viewset
4. Add URLs to your router
5. Register in Django admin
6. Test the endpoints
7. The Next.js admin panel will automatically work once endpoints are available

